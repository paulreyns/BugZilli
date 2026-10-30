import {
  FALLBACK_SELECT_VALUES,
  STATUS_SUGGESTIONS,
  fieldEditorMeta,
} from "./bug-update.js";
import {
  formatExtraFieldValue,
  readBugFieldValue,
} from "./detail-fields.js";
import type { BoardColumnConfig, Bug, DetailFieldOption } from "./types.js";

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

/**
 * Settings inbox and Board lane for group-by values that have not been mapped
 * into a named column. Not stored on the project.
 */
export const UNASSIGNED_BOARD_COLUMN_ID = "__new__";
export const UNASSIGNED_BOARD_COLUMN_NAME = "New";

const MAX_BOARD_COLUMN_NAME_LENGTH = 80;

export function boardValueIdentity(
  groupBy: string | undefined,
  value: string,
): string {
  const key = resolveBoardGroupBy(groupBy);
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (key === DEFAULT_BOARD_GROUP_BY) return trimmed.toUpperCase();
  return trimmed;
}

/** Group-by value shown for a bug, or UNKNOWN when the field is empty. */
export function boardBugGroupValue(bug: Bug, groupBy: string | undefined): string {
  return bugColumnValue(bug, resolveBoardGroupBy(groupBy));
}

/**
 * Drops blank columns, the reserved New id, duplicate ids, and duplicate
 * values (first column keeps the value). An invalid `columns` value becomes
 * an empty list, which means every group-by value is unmapped.
 */
export function cleanBoardColumns(
  columns: unknown,
  groupBy: string | undefined,
): BoardColumnConfig[] {
  if (!Array.isArray(columns)) return [];
  const seenIds = new Set<string>();
  const seenValues = new Set<string>();
  const cleaned: BoardColumnConfig[] = [];

  for (const entry of columns) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as { id?: unknown; name?: unknown; values?: unknown };
    if (typeof record.id !== "string" || typeof record.name !== "string") continue;
    const id = record.id.trim();
    const name = record.name.trim();
    if (
      !id ||
      !name ||
      id === UNASSIGNED_BOARD_COLUMN_ID ||
      name.length > MAX_BOARD_COLUMN_NAME_LENGTH ||
      seenIds.has(id)
    ) {
      continue;
    }
    seenIds.add(id);
    const values: string[] = [];
    if (Array.isArray(record.values)) {
      for (const raw of record.values) {
        if (typeof raw !== "string") continue;
        const value = raw.trim();
        const identity = boardValueIdentity(groupBy, value);
        if (!identity || seenValues.has(identity)) continue;
        seenValues.add(identity);
        values.push(value);
      }
    }
    cleaned.push({ id, name, values });
  }

  return cleaned;
}

function legacyBoardColumnId(groupBy: string, value: string): string {
  return `legacy:${boardValueIdentity(groupBy, value)}`;
}

/**
 * Named columns to edit and render.
 * An explicit `boardColumns` array (including empty) is the source of truth.
 * When it is omitted, each legacy status becomes a column of the same name
 * containing that single value, so existing boards keep their layout.
 */
export function resolveUserBoardColumns(
  boardColumns: BoardColumnConfig[] | undefined,
  legacyStatuses: string[] | undefined,
  groupBy: string | undefined,
): BoardColumnConfig[] {
  const key = resolveBoardGroupBy(groupBy);
  if (boardColumns) return cleanBoardColumns(boardColumns, key);
  return resolveBoardStatuses(legacyStatuses, key).map((status) => ({
    id: legacyBoardColumnId(key, status),
    name: status.replaceAll("_", " "),
    values: [status],
  }));
}

/** Field values that are not mapped into any named column, in field order. */
export function unassignedBoardValues(
  groupBy: string | undefined,
  knownValues: readonly string[],
  columns: readonly BoardColumnConfig[],
): string[] {
  const assigned = new Set<string>();
  for (const column of columns) {
    for (const value of column.values) {
      const identity = boardValueIdentity(groupBy, value);
      if (identity) assigned.add(identity);
    }
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of knownValues) {
    if (typeof raw !== "string") continue;
    const identity = boardValueIdentity(groupBy, raw);
    if (!identity || seen.has(identity) || assigned.has(identity)) continue;
    seen.add(identity);
    result.push(raw.trim());
  }
  return result;
}

export function createBoardColumn(name: string, id?: string): BoardColumnConfig {
  const column: BoardColumnConfig = {
    id: id?.trim() || crypto.randomUUID(),
    name: name.trim(),
    values: [],
  };
  return column;
}

/** Keeps column names and order, and drops every mapped value. */
export function clearBoardColumnValues(
  columns: readonly BoardColumnConfig[],
): BoardColumnConfig[] {
  return columns.map((column) => ({
    id: column.id,
    name: column.name,
    values: [],
  }));
}

export function moveBoardColumn(
  columns: readonly BoardColumnConfig[],
  columnId: string,
  direction: -1 | 1,
): BoardColumnConfig[] {
  const from = columns.findIndex((column) => column.id === columnId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= columns.length) {
    return columns.map((column) => ({ ...column, values: [...column.values] }));
  }
  const next = columns.map((column) => ({ ...column, values: [...column.values] }));
  const [item] = next.splice(from, 1);
  if (!item) return next;
  next.splice(to, 0, item);
  return next;
}

/**
 * Moves a group-by value into a named column, or back to New when
 * `toColumnId` is the unassigned id. Appends unless `toIndex` is set.
 * Values already in the destination stay put when the destination is New
 * only in the sense that they are removed from every column.
 */
export function moveBoardValue(
  columns: readonly BoardColumnConfig[],
  groupBy: string | undefined,
  value: string,
  toColumnId: string,
  toIndex?: number,
): BoardColumnConfig[] {
  const identity = boardValueIdentity(groupBy, value);
  const trimmed = value.trim();
  if (!identity || !trimmed) {
    return columns.map((column) => ({ ...column, values: [...column.values] }));
  }

  const targetIsNew = toColumnId === UNASSIGNED_BOARD_COLUMN_ID;
  const targetExists =
    targetIsNew || columns.some((column) => column.id === toColumnId);
  if (!targetExists) {
    return columns.map((column) => ({ ...column, values: [...column.values] }));
  }

  if (targetIsNew) {
    return columns.map((column) => ({
      ...column,
      values: column.values.filter(
        (entry) => boardValueIdentity(groupBy, entry) !== identity,
      ),
    }));
  }

  return columns.map((column) => {
    const currentIndex = column.values.findIndex(
      (entry) => boardValueIdentity(groupBy, entry) === identity,
    );
    const without = column.values.filter(
      (entry) => boardValueIdentity(groupBy, entry) !== identity,
    );
    if (column.id !== toColumnId) return { ...column, values: without };
    let index = toIndex === undefined ? without.length : toIndex;
    if (currentIndex >= 0 && currentIndex < index) index -= 1;
    index = Math.max(0, Math.min(index, without.length));
    const values = [...without];
    values.splice(index, 0, trimmed);
    return { ...column, values };
  });
}

export interface MappedBoardColumn {
  id: string;
  name: string;
  /** Group-by values mapped to this column. Empty for the unassigned lane. */
  values: string[];
  bugs: Bug[];
  /** True for the New lane that holds bugs whose value is not mapped. */
  unassigned?: boolean;
}

export interface MappedBoardOptions {
  groupBy?: string;
  columns: readonly BoardColumnConfig[];
  showClosedBugs?: boolean;
}

function isClosedOnlyColumn(
  groupBy: string,
  column: BoardColumnConfig,
): boolean {
  if (groupBy !== DEFAULT_BOARD_GROUP_BY || column.values.length === 0) {
    return false;
  }
  return column.values.every(
    (value) => boardValueIdentity(groupBy, value) === CLOSED_BOARD_STATUS,
  );
}

/**
 * Places bugs into the named columns their group-by value is mapped to.
 * Unmapped bugs go in New. New is omitted when it is empty and at least one
 * named column is visible. A status column that only contains CLOSED is
 * omitted unless closed bugs are shown.
 */
export function groupBugsByMappedBoard(
  bugs: Bug[],
  options: MappedBoardOptions,
): MappedBoardColumn[] {
  const groupBy = resolveBoardGroupBy(options.groupBy);
  const showClosedBugs = options.showClosedBugs;
  const userColumns = cleanBoardColumns(options.columns, groupBy).filter(
    (column) => showClosedBugs || !isClosedOnlyColumn(groupBy, column),
  );

  const columnIdByValue = new Map<string, string>();
  for (const column of userColumns) {
    for (const value of column.values) {
      const identity = boardValueIdentity(groupBy, value);
      if (!identity || columnIdByValue.has(identity)) continue;
      columnIdByValue.set(identity, column.id);
    }
  }

  const groups = new Map<string, Bug[]>(
    userColumns.map((column) => [column.id, []]),
  );
  const unassigned: Bug[] = [];

  for (const bug of bugs) {
    if (
      !showClosedBugs &&
      bug.status.trim().toUpperCase() === CLOSED_BOARD_STATUS
    ) {
      continue;
    }
    const raw = bugColumnValue(bug, groupBy);
    const columnId = columnIdByValue.get(boardValueIdentity(groupBy, raw));
    if (columnId) {
      groups.get(columnId)?.push(bug);
      continue;
    }
    unassigned.push(bug);
  }

  const lanes: MappedBoardColumn[] = userColumns.map((column) => ({
    id: column.id,
    name: column.name,
    values: [...column.values],
    bugs: groups.get(column.id) ?? [],
  }));

  if (unassigned.length > 0 || lanes.length === 0) {
    lanes.unshift({
      id: UNASSIGNED_BOARD_COLUMN_ID,
      name: UNASSIGNED_BOARD_COLUMN_NAME,
      values: [],
      bugs: unassigned,
      unassigned: true,
    });
  }

  return lanes;
}
