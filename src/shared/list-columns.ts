import {
  detailFieldDefinition,
  type DetailFieldDefinition,
} from "./detail-fields.js";
import type { DetailFieldOption } from "./types.js";

/** Columns shown in the Issues table by default (current layout). */
export const DEFAULT_LIST_COLUMNS = [
  "id",
  "summary",
  "assignedTo",
  "priority",
  "status",
  "lastChangeTime",
] as const;

const LIST_ONLY_FIELDS: DetailFieldDefinition[] = [
  { key: "id", label: "Key", bugzilla: "id" },
  { key: "summary", label: "Summary", bugzilla: "summary" },
];

const listOnlyByKey = new Map(
  LIST_ONLY_FIELDS.map((field) => [field.key, field]),
);

export function defaultListColumns(): string[] {
  return [...DEFAULT_LIST_COLUMNS];
}

export function resolveListColumns(columns: string[] | undefined): string[] {
  if (!columns || columns.length === 0) return defaultListColumns();
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const column of columns) {
    const key = column.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    resolved.push(key);
  }
  return resolved.length > 0 ? resolved : defaultListColumns();
}

export function listColumnDefinition(key: string): DetailFieldDefinition {
  return listOnlyByKey.get(key) ?? detailFieldDefinition(key);
}

/** Ensures Key and Summary are always offered for the list table picker. */
export function catalogForListColumns(
  options: DetailFieldOption[],
): DetailFieldOption[] {
  const seen = new Set(options.map(({ key }) => key));
  const extras = LIST_ONLY_FIELDS.filter(({ key }) => !seen.has(key)).map(
    ({ key, label }) => ({ key, label }),
  );
  return [...extras, ...options];
}
