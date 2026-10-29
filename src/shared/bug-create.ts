import {
  isClosedStatus,
  isOpenStatus,
  normalizeResolution,
  parseKeywords,
} from "./bug-update.js";
import {
  bugzillaChartNameForKey,
  bugzillaNameForKey,
  detailFieldDefinition,
  isExtraDetailField,
  resolveDetailFields,
} from "./detail-fields.js";
import type { BugCreate, DetailFieldOption, DetailFieldType } from "./types.js";

/** Fields Bugzilla sets itself; they are shown read-only on the add form. */
const CREATE_READONLY_FIELDS = new Set([
  "id",
  "creator",
  "creationTime",
  "lastChangeTime",
  "classification",
]);

/**
 * Bugzilla's create API rejects a bug that omits these, even when field
 * metadata is missing the mandatory flag.
 */
const ALWAYS_REQUIRED_ON_CREATE = new Set(["summary", "component", "version"]);

const FIELD_ALIASES: Record<string, readonly string[]> = {
  assignedTo: ["assignee", "assigned to"],
  platform: ["hardware"],
  opSys: ["operating system"],
  severity: ["bug severity"],
  status: ["bug status"],
  qaContact: ["qa contact"],
  targetMilestone: ["target milestone"],
  creationTime: ["creation time"],
  lastChangeTime: ["last change time"],
};

export function isCreateReadonlyField(key: string): boolean {
  return CREATE_READONLY_FIELDS.has(key);
}

/**
 * Sidebar fields for the add-bug form. Matches the detail page while editing:
 * the project's configured fields, with status included.
 */
export function addBugFieldKeys(configured: string[] | undefined): string[] {
  const fields = resolveDetailFields(configured);
  return fields.includes("status") ? fields : ["status", ...fields];
}

export function emptyBugCreate(fieldKeys: string[]): BugCreate {
  const extraFields: Record<string, string> = {};
  for (const key of fieldKeys) {
    if (isCreateReadonlyField(key) || !isExtraDetailField(key)) continue;
    extraFields[key] = "";
  }
  return {
    summary: "",
    description: "",
    status: "",
    resolution: "",
    assignedTo: "",
    priority: "",
    severity: "",
    component: "",
    version: "",
    platform: "",
    keywords: "",
    extraFields,
  };
}

export function readCreateField(draft: BugCreate, key: string): string {
  switch (key) {
    case "summary":
      return draft.summary;
    case "description":
      return draft.description;
    case "status":
      return draft.status;
    case "resolution":
      return draft.resolution;
    case "assignedTo":
      return draft.assignedTo;
    case "priority":
      return draft.priority;
    case "severity":
      return draft.severity;
    case "component":
      return draft.component;
    case "version":
      return draft.version;
    case "platform":
      return draft.platform;
    case "keywords":
      return draft.keywords;
    default:
      return draft.extraFields[key] ?? "";
  }
}

export function writeCreateField(
  draft: BugCreate,
  key: string,
  value: string,
): BugCreate {
  switch (key) {
    case "summary":
      return { ...draft, summary: value };
    case "description":
      return { ...draft, description: value };
    case "status":
      return {
        ...draft,
        status: value,
        ...(isOpenStatus(value) ? { resolution: "" } : {}),
      };
    case "resolution":
      return { ...draft, resolution: value };
    case "assignedTo":
      return { ...draft, assignedTo: value };
    case "priority":
      return { ...draft, priority: value };
    case "severity":
      return { ...draft, severity: value };
    case "component":
      return { ...draft, component: value };
    case "version":
      return { ...draft, version: value };
    case "platform":
      return { ...draft, platform: value };
    case "keywords":
      return { ...draft, keywords: value };
    default:
      return {
        ...draft,
        extraFields: { ...draft.extraFields, [key]: value },
      };
  }
}

export function isCreateFieldRequired(
  key: string,
  option: DetailFieldOption | undefined,
  status: string,
): boolean {
  if (isCreateReadonlyField(key)) return false;
  if (key === "resolution") return isClosedStatus(status);
  if (ALWAYS_REQUIRED_ON_CREATE.has(key)) return true;
  return option?.required === true;
}

function isBlank(value: string, key: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (key === "resolution" && (trimmed === "---" || trimmed === "--")) return true;
  return false;
}

export function validateBugCreate(
  draft: BugCreate,
  fieldKeys: string[],
  optionsByKey: ReadonlyMap<string, DetailFieldOption>,
): Record<string, string> {
  const issues: Record<string, string> = {};

  const summary = draft.summary.trim();
  if (!summary) issues.summary = "Summary is required.";
  else if (summary.length > 255) {
    issues.summary = "Summary must be 255 characters or fewer.";
  }

  const description = draft.description.trim();
  if (description.length > 65_535) {
    issues.description = "Description must be 65,535 characters or fewer.";
  } else if (
    isCreateFieldRequired("description", optionsByKey.get("description"), draft.status) &&
    !description
  ) {
    issues.description = "Description is required.";
  }

  for (const key of fieldKeys) {
    if (isCreateReadonlyField(key)) continue;
    const option = optionsByKey.get(key);
    if (!isCreateFieldRequired(key, option, draft.status)) continue;
    if (!isBlank(readCreateField(draft, key), key)) continue;
    const label = option?.label || detailFieldDefinition(key).label;
    issues[key] = `${label} is required.`;
  }

  const status = draft.status.trim();
  const resolution = normalizeResolution(draft.resolution);
  if (isClosedStatus(status) && !resolution) {
    issues.resolution = "Choose a resolution before closing this bug.";
  } else if (resolution && isOpenStatus(status)) {
    issues.resolution = "Clear the resolution before saving an open bug.";
  } else if (resolution && !status) {
    issues.resolution = "Set a closed status before choosing a resolution.";
  }

  return issues;
}

export function bugCreateErrorSummary(issues: Record<string, string>): string {
  const messages = Object.values(issues);
  if (messages.length === 0) return "";
  if (messages.length === 1) return messages[0] ?? "";
  return "Some fields need attention.";
}

export function firstCreateIssueKey(
  issues: Record<string, string>,
  fieldKeys: string[],
): string | undefined {
  for (const key of ["summary", "description", ...fieldKeys]) {
    if (issues[key]) return key;
  }
  return Object.keys(issues)[0];
}

function mentionsField(message: string, name: string): boolean {
  const escaped = name
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  if (!escaped) return false;
  return new RegExp(`(^|[^a-z0-9_])${escaped}([^a-z0-9_]|$)`, "i").test(message);
}

function namesForField(
  key: string,
  option: DetailFieldOption | undefined,
): string[] {
  const names = [
    key,
    detailFieldDefinition(key).label,
    bugzillaNameForKey(key),
    bugzillaChartNameForKey(key),
    option?.label ?? "",
    ...(FIELD_ALIASES[key] ?? []),
  ];
  return [...new Set(names.map((name) => name.trim()).filter((name) => name.length >= 3))];
}

/**
 * Map a Bugzilla (or validation) error message onto add-form field keys.
 * Summary and description are always candidates; sidebar keys come from the form.
 */
export function fieldsForCreateError(
  message: string,
  fieldKeys: string[],
  options: readonly DetailFieldOption[],
): string[] {
  const optionsByKey = new Map(options.map((option) => [option.key, option]));
  const keys = ["summary", "description", ...fieldKeys.filter((key) => key !== "summary" && key !== "description")];
  const seen = new Set<string>();
  const matched: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const names = namesForField(key, optionsByKey.get(key));
    if (names.some((name) => mentionsField(message, name))) matched.push(key);
  }
  return matched;
}

export function buildBugCreate(
  product: string,
  draft: BugCreate,
  fieldTypes: Record<string, DetailFieldType> = {},
): Record<string, unknown> {
  const productName = product.trim();
  if (!productName) {
    throw new Error("Set the Bugzilla product name before filing a bug.");
  }
  const summary = draft.summary.trim();
  if (!summary) throw new Error("Summary cannot be empty.");
  if (summary.length > 255) {
    throw new Error("Summary must be 255 characters or fewer.");
  }

  const body: Record<string, unknown> = {
    product: productName,
    summary,
  };

  const description = draft.description.trim();
  if (description.length > 65_535) {
    throw new Error("Description must be 65,535 characters or fewer.");
  }
  if (description) body.description = description;

  const status = draft.status.trim();
  const scalarFields: [keyof BugCreate, string][] = [
    ["status", "status"],
    ["priority", "priority"],
    ["severity", "severity"],
    ["assignedTo", "assigned_to"],
    ["component", "component"],
    ["version", "version"],
    ["platform", "platform"],
  ];
  for (const [key, name] of scalarFields) {
    const value = draft[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) body[name] = trimmed;
  }

  const resolution = normalizeResolution(draft.resolution);
  if (resolution && !isOpenStatus(status)) body.resolution = resolution;

  const keywords = parseKeywords(draft.keywords);
  if (keywords.length > 0) body.keywords = keywords;

  for (const [key, raw] of Object.entries(draft.extraFields)) {
    if (!isExtraDetailField(key)) continue;
    const field = bugzillaNameForKey(key);
    if (!field || field === "product" || field === "summary" || field === "description") {
      continue;
    }
    if (fieldTypes[key] === "multiselect" || fieldTypes[key] === "keywords") {
      const values = parseKeywords(raw);
      if (values.length > 0) body[field] = values;
      continue;
    }
    const value = raw.trim();
    if (value) body[field] = value;
  }

  return body;
}
