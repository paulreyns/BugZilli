import {
  FALLBACK_SELECT_VALUES,
  STATUS_SUGGESTIONS,
  fieldEditorMeta,
} from "./bug-update.js";
import {
  formatExtraFieldValue,
  readBugFieldValue,
} from "./detail-fields.js";
import type { Bug, DetailFieldOption } from "./types.js";

/** Canonical Bugzilla statuses shown as Board columns by default. */
export const DEFAULT_BOARD_STATUSES = [...STATUS_SUGGESTIONS];

/** Field used to group Board columns when unset. */
export const DEFAULT_BOARD_GROUP_BY = "status";

/** Status key gated by the product "Show closed bugs" setting. */
export const CLOSED_BOARD_STATUS = "CLOSED";

export function defaultBoardStatuses(): string[] {
  return [...DEFAULT_BOARD_STATUSES];
}

export function resolveBoardGroupBy(groupBy: string | undefined): string {
  const key = typeof groupBy === "string" ? groupBy.trim() : "";
  return key || DEFAULT_BOARD_GROUP_BY;
}

/**
 * Default column values for a board group-by field.
 * Status uses the standard workflow; other known selects use built-in lists.
 */
export function defaultColumnsForGroupBy(groupBy: string | undefined): string[] {
  const key = resolveBoardGroupBy(groupBy);
  if (key === DEFAULT_BOARD_GROUP_BY) return defaultBoardStatuses();
  const fallback = FALLBACK_SELECT_VALUES[key];
  return fallback ? [...fallback] : [];
}

/**
 * True when a Bugzilla field can be used as a Board group-by column:
 * single-select / combo / lookup fields with a defined value list.
 */
export function isBoardGroupByField(option: DetailFieldOption): boolean {
  const meta = fieldEditorMeta(option.key, option);
  return meta.type === "select" && (meta.values?.length ?? 0) > 0;
}

/** Select-type fields with defined values, suitable for the Board group-by list. */
export function boardGroupByFields(
  catalog: DetailFieldOption[],
): DetailFieldOption[] {
  const seen = new Set<string>();
  const fields: DetailFieldOption[] = [];

  for (const option of catalog) {
    if (!isBoardGroupByField(option) || seen.has(option.key)) continue;
    seen.add(option.key);
    fields.push({
      ...option,
      ...fieldEditorMeta(option.key, option),
    });
  }

  // Ensure status is always available even when the catalog is empty/offline.
  if (!seen.has(DEFAULT_BOARD_GROUP_BY)) {
    fields.unshift({
      key: DEFAULT_BOARD_GROUP_BY,
      label: "Status",
      type: "select",
      values: defaultBoardStatuses(),
    });
  }

  return fields;
}

/**
 * Ordered board columns from product settings.
 * For status, always includes every default status (appended if missing) so
 * empty columns still appear. For other fields, uses the configured order
 * when present, otherwise the field's default value list.
 */
export function resolveBoardStatuses(
  statuses: string[] | undefined,
  groupBy?: string,
): string[] {
  const key = resolveBoardGroupBy(groupBy);
  const defaults = defaultColumnsForGroupBy(key);
  if (!statuses || statuses.length === 0) return defaults;

  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const status of statuses) {
    if (typeof status !== "string") continue;
    const value = status.trim();
    if (!value) continue;
    const identity = columnIdentity(key, value);
    if (seen.has(identity)) continue;
    seen.add(identity);
    resolved.push(value);
  }

  // Only backfill missing defaults for status so custom field orders stay exact.
  if (key === DEFAULT_BOARD_GROUP_BY) {
    for (const status of defaults) {
      const identity = columnIdentity(key, status);
      if (seen.has(identity)) continue;
      seen.add(identity);
      resolved.push(status);
    }
  }

  return resolved.length > 0 ? resolved : defaults;
}

/** Columns to render, omitting CLOSED unless show-closed is enabled (status only). */
export function boardStatusesForDisplay(
  statuses: string[] | undefined,
  showClosedBugs: boolean | undefined,
  groupBy?: string,
): string[] {
  const key = resolveBoardGroupBy(groupBy);
  const resolved = resolveBoardStatuses(statuses, key);
  if (key !== DEFAULT_BOARD_GROUP_BY || showClosedBugs) return resolved;
  return resolved.filter(
    (status) => status.toUpperCase() !== CLOSED_BOARD_STATUS,
  );
}

export interface BoardColumn {
  status: string;
  bugs: Bug[];
}

export interface GroupBugsByBoardOptions {
  groupBy?: string;
  columns?: string[];
  showClosedBugs?: boolean;
}

function columnIdentity(groupBy: string, value: string): string {
  // Status matching has always been case-insensitive.
  if (groupBy === DEFAULT_BOARD_GROUP_BY) return value.toUpperCase();
  return value;
}

function bugColumnValue(bug: Bug, groupBy: string): string {
  const raw = readBugFieldValue(bug, groupBy);
  const text = formatExtraFieldValue(raw).trim();
  return text || "UNKNOWN";
}

/**
 * Groups bugs into ordered board columns for the configured group-by field.
 * Configured columns always appear (even when empty). Unexpected values from
 * bugs are appended at the end. CLOSED bugs/columns are omitted when grouping
 * by status and showClosedBugs is off; for other fields, closed bugs are still
 * filtered out of the board when showClosedBugs is off.
 */
export function groupBugsByBoardStatus(
  bugs: Bug[],
  statuses: string[] | undefined,
  showClosedBugs: boolean | undefined,
  groupBy?: string,
): BoardColumn[] {
  return groupBugsByBoard(
    {
      ...(groupBy !== undefined ? { groupBy } : {}),
      ...(statuses !== undefined ? { columns: statuses } : {}),
      ...(showClosedBugs !== undefined ? { showClosedBugs } : {}),
    },
    bugs,
  );
}

export function groupBugsByBoard(
  options: GroupBugsByBoardOptions,
  bugs: Bug[],
): BoardColumn[] {
  const groupBy = resolveBoardGroupBy(options.groupBy);
  const showClosedBugs = options.showClosedBugs;
  const columns = boardStatusesForDisplay(
    options.columns,
    showClosedBugs,
    groupBy,
  );
  const groups = new Map<string, Bug[]>();
  const columnByIdentity = new Map<string, string>();

  for (const column of columns) {
    groups.set(column, []);
    columnByIdentity.set(columnIdentity(groupBy, column), column);
  }

  const extras: string[] = [];
  for (const bug of bugs) {
    if (
      !showClosedBugs &&
      bug.status.trim().toUpperCase() === CLOSED_BOARD_STATUS
    ) {
      continue;
    }

    const raw = bugColumnValue(bug, groupBy);
    const identity = columnIdentity(groupBy, raw);
    const existing = columnByIdentity.get(identity);
    if (existing) {
      groups.get(existing)!.push(bug);
      continue;
    }

    groups.set(raw, [bug]);
    columnByIdentity.set(identity, raw);
    extras.push(raw);
  }

  return [...columns, ...extras].map((status) => ({
    status,
    bugs: groups.get(status) ?? [],
  }));
}
