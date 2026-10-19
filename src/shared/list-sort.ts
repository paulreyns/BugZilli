import { formatExtraFieldValue, readBugFieldValue } from "./detail-fields.js";
import { listColumnDefinition } from "./list-columns.js";
import type { Bug } from "./types.js";

export type SortDirection = "asc" | "desc";

export interface ListSort {
  column: string;
  direction: SortDirection;
}

/** Saved sort per Bugzilla product, since each product has its own fields. */
export type ListSortsByProduct = Record<string, ListSort>;

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function isDateColumn(column: string): boolean {
  return listColumnDefinition(column).format === "date" || column === "deadline";
}

function sortValue(bug: Bug, column: string): string | number | null {
  if (column === "id") return bug.id;
  if (column === "assignedTo") {
    return bug.assignedToName || bug.assignedTo || null;
  }
  const raw = readBugFieldValue(bug, column);
  if (typeof raw === "number") return raw;
  const text = formatExtraFieldValue(raw).trim();
  if (!text || text === "--" || text === "---") return null;
  if (isDateColumn(column)) {
    const time = Date.parse(text);
    if (!Number.isNaN(time)) return time;
  }
  return text;
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

/** Returns a sorted copy. Empty values always sort last; ties keep input order. */
export function sortBugs(bugs: Bug[], sort: ListSort | undefined): Bug[] {
  if (!sort) return bugs;
  const factor = sort.direction === "asc" ? 1 : -1;
  return bugs
    .map((bug, index) => ({ bug, index, value: sortValue(bug, sort.column) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        if (a.value === b.value) return a.index - b.index;
        return a.value === null ? 1 : -1;
      }
      return compareValues(a.value, b.value) * factor || a.index - b.index;
    })
    .map(({ bug }) => bug);
}

/** Cycles a header click through ascending, descending, then unsorted. */
export function nextSort(
  current: ListSort | undefined,
  column: string,
): ListSort | undefined {
  if (current?.column !== column) return { column, direction: "asc" };
  if (current.direction === "asc") return { column, direction: "desc" };
  return undefined;
}

export function parseListSorts(value: unknown): ListSortsByProduct {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const sorts: ListSortsByProduct = {};
  for (const [product, sort] of Object.entries(value)) {
    if (!sort || typeof sort !== "object") continue;
    const { column, direction } = sort as Partial<ListSort>;
    if (typeof column !== "string" || !column) continue;
    if (direction !== "asc" && direction !== "desc") continue;
    sorts[product] = { column, direction };
  }
  return sorts;
}
