import {
  bugzillaChartNameForKey,
  bugzillaNameForKey,
  detailFieldDefinition,
} from "./detail-fields.js";
import type { FilterOperator, FilterRule, SavedFilter } from "./types.js";

/** Built-in filter that applies no field criteria. Always shown; never persisted. */
export const ALL_FILTER_ID = "all";

/** Selected saved-filter id per Bugzilla product (`all` when unset). */
export type SelectedFiltersByProduct = Record<string, string>;

export const DEFAULT_FILTER_OPERATOR: FilterOperator = "equals";

/** Operators offered in the filter add/edit UI (Bugzilla Custom Search names). */
export const FILTER_OPERATORS: ReadonlyArray<{
  value: FilterOperator;
  label: string;
  /** When true, the value input is unused for this operator. */
  valueless?: boolean;
}> = [
  { value: "equals", label: "equals" },
  { value: "notequals", label: "does not equal" },
  { value: "anyexact", label: "is equal to any of the strings" },
  { value: "substring", label: "contains the string" },
  { value: "casesubstring", label: "contains the string (case sensitive)" },
  { value: "notsubstring", label: "does not contain the string" },
  { value: "anywords", label: "contains any of the words" },
  { value: "allwords", label: "contains all of the words" },
  { value: "nowords", label: "contains none of the words" },
  { value: "anywordssubstr", label: "contains any of the strings" },
  { value: "allwordssubstr", label: "contains all of the strings" },
  { value: "nowordssubstr", label: "contains none of the strings" },
  { value: "regexp", label: "matches regular expression" },
  { value: "notregexp", label: "does not match regular expression" },
  { value: "lessthan", label: "is less than" },
  { value: "lessthaneq", label: "is less than or equal to" },
  { value: "greaterthan", label: "is greater than" },
  { value: "greaterthaneq", label: "is greater than or equal to" },
  { value: "isempty", label: "is empty", valueless: true },
  { value: "isnotempty", label: "is not empty", valueless: true },
];

const OPERATOR_SET = new Set(
  FILTER_OPERATORS.map((entry) => entry.value),
) as Set<string>;

const VALUELESS_OPERATORS = new Set(
  FILTER_OPERATORS.filter((entry) => entry.valueless).map(
    (entry) => entry.value,
  ),
);

export function isFilterOperator(value: unknown): value is FilterOperator {
  return typeof value === "string" && OPERATOR_SET.has(value);
}

export function normalizeFilterOperator(
  value: unknown,
): FilterOperator {
  return isFilterOperator(value) ? value : DEFAULT_FILTER_OPERATOR;
}

export function operatorNeedsValue(operator: FilterOperator): boolean {
  return !VALUELESS_OPERATORS.has(operator);
}

export function operatorLabel(operator: FilterOperator): string {
  return (
    FILTER_OPERATORS.find((entry) => entry.value === operator)?.label ??
    operator
  );
}

export function filterDisplayName(filter: SavedFilter): string {
  const named = filter.name.trim();
  if (named) return named;
  return summarizeRules(filter.rules) || "Untitled filter";
}

export function summarizeRules(rules: FilterRule[]): string {
  const parts = cleanFilterRules(rules).map((rule) => {
    const label = detailFieldDefinition(rule.field).label;
    const op = operatorLabel(rule.operator ?? DEFAULT_FILTER_OPERATOR);
    if (!operatorNeedsValue(rule.operator ?? DEFAULT_FILTER_OPERATOR)) {
      return `${label} ${op}`;
    }
    return `${label} ${op} ${rule.value.trim()}`;
  });
  return parts.join(" · ");
}

export function cleanFilterRules(rules: FilterRule[] | undefined): FilterRule[] {
  if (!Array.isArray(rules)) return [];
  const cleaned: FilterRule[] = [];
  for (const rule of rules) {
    if (!rule || typeof rule !== "object") continue;
    const field = typeof rule.field === "string" ? rule.field.trim() : "";
    if (!field) continue;
    const operator = normalizeFilterOperator(rule.operator);
    const value = typeof rule.value === "string" ? rule.value.trim() : "";
    if (operatorNeedsValue(operator) && !value) continue;
    cleaned.push(
      operatorNeedsValue(operator)
        ? { field, operator, value }
        : { field, operator, value: "" },
    );
  }
  return cleaned;
}

export function cleanSavedFilters(
  filters: SavedFilter[] | undefined,
): SavedFilter[] | undefined {
  if (!Array.isArray(filters)) return undefined;
  const cleaned: SavedFilter[] = [];
  const seen = new Set<string>();
  for (const filter of filters) {
    if (!filter || typeof filter !== "object") continue;
    const id = typeof filter.id === "string" ? filter.id.trim() : "";
    if (!id || id === ALL_FILTER_ID || seen.has(id)) continue;
    const rules = cleanFilterRules(filter.rules);
    if (rules.length === 0) continue;
    seen.add(id);
    const name =
      typeof filter.name === "string" && filter.name.trim()
        ? filter.name.trim()
        : summarizeRules(rules);
    cleaned.push({ id, name, rules });
  }
  return cleaned.length > 0 ? cleaned : undefined;
}

export function parseSelectedFilters(value: unknown): SelectedFiltersByProduct {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const selected: SelectedFiltersByProduct = {};
  for (const [product, filterId] of Object.entries(value)) {
    if (typeof filterId !== "string" || !filterId.trim()) continue;
    selected[product] = filterId.trim();
  }
  return selected;
}

/** Resolve which saved filter is active; unknown ids fall back to All. */
export function resolveSelectedFilterId(
  selectedId: string | undefined,
  filters: SavedFilter[] | undefined,
): string {
  if (!selectedId || selectedId === ALL_FILTER_ID) return ALL_FILTER_ID;
  if (filters?.some((filter) => filter.id === selectedId)) return selectedId;
  return ALL_FILTER_ID;
}

export function rulesForSelectedFilter(
  selectedId: string | undefined,
  filters: SavedFilter[] | undefined,
): FilterRule[] {
  const id = resolveSelectedFilterId(selectedId, filters);
  if (id === ALL_FILTER_ID) return [];
  return filters?.find((filter) => filter.id === id)?.rules ?? [];
}

/**
 * True when a resolution rule only matches open bugs (`resolution ---`),
 * which is compatible with projects that hide closed bugs.
 */
export function isOpenResolutionRule(rule: FilterRule): boolean {
  if (bugzillaNameForKey(rule.field) !== "resolution") return false;
  const operator = normalizeFilterOperator(rule.operator);
  return (
    (operator === "equals" || operator === "anyexact") &&
    rule.value.trim() === "---"
  );
}

/** Append Bugzilla Custom Search params (`fN` / `oN` / `vN`) for filter rules. */
export function appendFilterParams(
  params: URLSearchParams,
  rules: FilterRule[] | undefined,
): void {
  const cleaned = cleanFilterRules(rules);
  cleaned.forEach((rule, index) => {
    const n = index + 1;
    const operator = normalizeFilterOperator(rule.operator);
    params.set(`f${n}`, bugzillaChartNameForKey(rule.field));
    params.set(`o${n}`, operator);
    if (operatorNeedsValue(operator)) {
      params.set(`v${n}`, rule.value);
    }
  });
}
