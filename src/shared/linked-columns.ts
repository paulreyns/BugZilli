/** Columns shown in Linked Bugs tables by default (current layout). */
export const DEFAULT_LINKED_COLUMNS = [
  "id",
  "summary",
  "assignedTo",
] as const;

export function defaultLinkedColumns(): string[] {
  return [...DEFAULT_LINKED_COLUMNS];
}

export function resolveLinkedColumns(columns: string[] | undefined): string[] {
  if (!columns || columns.length === 0) return defaultLinkedColumns();
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const column of columns) {
    const key = column.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    resolved.push(key);
  }
  return resolved.length > 0 ? resolved : defaultLinkedColumns();
}
