/** Columns shown in the Issues table by default (current layout). */
export const DEFAULT_LIST_COLUMNS = [
  "id",
  "summary",
  "assignedTo",
  "priority",
  "status",
  "lastChangeTime",
] as const;

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
