import { isExtraDetailField } from "./detail-fields.js";
import type {
  Bug,
  BugUpdate,
  DetailFieldOption,
  DetailFieldType,
} from "./types.js";

export interface BugDraft {
  summary: string;
  status: string;
  resolution: string;
  assignedTo: string;
  priority: string;
  severity: string;
  component: string;
  version: string;
  platform: string;
  keywords: string;
  /** Draft values for custom / uncommon fields shown in Details. */
  extraFields: Record<string, string>;
}

export const STATUS_SUGGESTIONS = [
  "UNCONFIRMED",
  "NEW",
  "ASSIGNED",
  "REOPENED",
  "RESOLVED",
  "VERIFIED",
  "CLOSED",
];

export const RESOLUTION_SUGGESTIONS = [
  "FIXED",
  "INVALID",
  "WONTFIX",
  "DUPLICATE",
  "WORKSFORME",
  "INCOMPLETE",
  "MOVED",
];

export const PRIORITY_SUGGESTIONS = ["--", "P1", "P2", "P3", "P4", "P5"];

export const SEVERITY_SUGGESTIONS = [
  "--",
  "blocker",
  "critical",
  "major",
  "normal",
  "minor",
  "trivial",
  "enhancement",
];

const OPEN_STATUSES = new Set(["UNCONFIRMED", "NEW", "ASSIGNED", "REOPENED"]);
const CLOSED_STATUSES = new Set(["RESOLVED", "VERIFIED", "CLOSED"]);

export function isOpenStatus(status: string): boolean {
  return OPEN_STATUSES.has(status.trim().toUpperCase());
}

export function isClosedStatus(status: string): boolean {
  return CLOSED_STATUSES.has(status.trim().toUpperCase());
}

export function normalizeResolution(value: string): string {
  const trimmed = value.trim();
  return trimmed === "---" ? "" : trimmed;
}

export function parseKeywords(value: string): string[] {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

const FALLBACK_SELECT_VALUES: Record<string, readonly string[]> = {
  status: STATUS_SUGGESTIONS,
  priority: PRIORITY_SUGGESTIONS,
  severity: SEVERITY_SUGGESTIONS,
  resolution: RESOLUTION_SUGGESTIONS,
};

/**
 * Resolve the editor type and legal values for a Detail field.
 * Prefers Bugzilla `/rest/field/bug` metadata; falls back to built-in
 * select lists for common standard fields when the API omits values.
 */
export function fieldEditorMeta(
  fieldKey: string,
  fieldOption?: DetailFieldOption,
): { type?: DetailFieldType; values?: string[] } {
  const apiValues = fieldOption?.values?.filter(Boolean) ?? [];
  const fallback = FALLBACK_SELECT_VALUES[fieldKey];
  const values =
    apiValues.length > 0
      ? apiValues
      : fallback
        ? [...fallback]
        : undefined;

  const apiType = fieldOption?.type;
  const type =
    apiType && apiType !== "unknown"
      ? apiType
      : values && values.length > 0
        ? "select"
        : undefined;

  return {
    ...(type ? { type } : {}),
    ...(values && values.length > 0 ? { values } : {}),
  };
}

export function draftFromBug(
  bug: Bug,
  detailFieldKeys: string[] = [],
): BugDraft {
  const extraFields: Record<string, string> = { ...(bug.extraFields ?? {}) };
  for (const key of detailFieldKeys) {
    if (!isExtraDetailField(key)) continue;
    if (!(key in extraFields)) extraFields[key] = "";
  }
  return {
    summary: bug.summary,
    status: bug.status,
    resolution: normalizeResolution(bug.resolution),
    assignedTo: bug.assignedTo,
    priority: bug.priority,
    severity: bug.severity,
    component: bug.component,
    version: bug.version,
    platform: bug.platform,
    keywords: bug.keywords.join(", "),
    extraFields,
  };
}

function sameKeywords(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((keyword, index) => keyword === right[index])
  );
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const counts = new Map<string, number>();
  for (const value of left) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  for (const value of right) {
    const next = (counts.get(value) ?? 0) - 1;
    if (next < 0) return false;
    counts.set(value, next);
  }
  return true;
}

export function buildBugUpdate(
  bug: Bug,
  draft: BugDraft,
  fieldTypes: Record<string, DetailFieldType> = {},
): BugUpdate {
  const update: BugUpdate = {};
  const summary = draft.summary.trim();
  if (summary !== bug.summary) update.summary = summary;

  const status = draft.status.trim();
  if (status !== bug.status) update.status = status;

  const assignedTo = draft.assignedTo.trim();
  if (assignedTo !== bug.assignedTo) update.assignedTo = assignedTo;

  const priority = draft.priority.trim();
  if (priority !== bug.priority) update.priority = priority;

  const severity = draft.severity.trim();
  if (severity !== bug.severity) update.severity = severity;

  const component = draft.component.trim();
  if (component !== bug.component) update.component = component;

  const version = draft.version.trim();
  if (version !== bug.version) update.version = version;

  const platform = draft.platform.trim();
  if (platform !== bug.platform) update.platform = platform;

  const keywords = parseKeywords(draft.keywords);
  if (!sameKeywords(keywords, bug.keywords)) update.keywords = keywords;

  // Bugzilla clears the resolution when a bug moves to an open status, and
  // rejects a resolution on an open bug. Leave it out in that case.
  const resolution = normalizeResolution(draft.resolution);
  if (resolution !== normalizeResolution(bug.resolution) && !isOpenStatus(status)) {
    update.resolution = resolution;
  }

  const extraFields: Record<string, string | string[]> = {};
  const draftKeys = new Set([
    ...Object.keys(draft.extraFields),
    ...Object.keys(bug.extraFields ?? {}),
  ]);
  for (const key of draftKeys) {
    if (!isExtraDetailField(key)) continue;
    const nextRaw = draft.extraFields[key] ?? "";
    const currentRaw = bug.extraFields?.[key] ?? "";
    if (fieldTypes[key] === "multiselect") {
      const next = parseKeywords(nextRaw);
      const current = parseKeywords(currentRaw);
      if (!sameStringSet(next, current)) extraFields[key] = next;
      continue;
    }
    const next = nextRaw.trim();
    const current = currentRaw.trim();
    if (next !== current) extraFields[key] = next;
  }
  if (Object.keys(extraFields).length > 0) update.extraFields = extraFields;

  return update;
}

export function validateBugDraft(
  bug: Bug,
  draft: BugDraft,
  fieldTypes: Record<string, DetailFieldType> = {},
): string | null {
  const summary = draft.summary.trim();
  if (!summary) return "Summary cannot be empty.";
  if (summary.length > 255) return "Summary must be 255 characters or fewer.";
  if (!draft.status.trim()) return "Status cannot be empty.";
  if (!draft.assignedTo.trim() && bug.assignedTo.trim()) {
    return "Assignee cannot be empty.";
  }
  if (!draft.component.trim() && bug.component.trim()) {
    return "Component cannot be empty.";
  }

  const resolution = normalizeResolution(draft.resolution);
  if (isClosedStatus(draft.status) && !resolution) {
    return "Choose a resolution before closing this bug.";
  }
  if (isOpenStatus(draft.status) && resolution) {
    return "Clear the resolution before saving an open bug.";
  }
  if (Object.keys(buildBugUpdate(bug, draft, fieldTypes)).length === 0) {
    return "Change a field before saving.";
  }
  return null;
}
