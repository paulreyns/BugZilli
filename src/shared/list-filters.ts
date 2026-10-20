import { bugzillaNameForKey, detailFieldDefinition } from "./detail-fields.js";
import type { FilterRule, SavedFilter } from "./types.js";

/** Built-in filter that applies no field criteria. Always shown; never persisted. */
export const ALL_FILTER_ID = "all";

/** Selected saved-filter id per Bugzilla product (`all` when unset). */
export type SelectedFiltersByProduct = Record<string, string>;

export function filterDisplayName(filter: SavedFilter): string {
  const named = filter.name.trim();
  if (named) return named;
  return summarizeRules(filter.rules) || "Untitled filter";
}

export function summarizeRules(rules: FilterRule[]): string {
  const parts = rules
    .filter((rule) => rule.field.trim() && rule.value.trim())
    .map(
      (rule) =>
        `${detailFieldDefinition(rule.field).label} = ${rule.value.trim()}`,
    );
  return parts.join(" · ");
}

export function cleanFilterRules(rules: FilterRule[] | undefined): FilterRule[] {
  if (!Array.isArray(rules)) return [];
  const cleaned: FilterRule[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    if (!rule || typeof rule !== "object") continue;
    const field = typeof rule.field === "string" ? rule.field.trim() : "";
    const value = typeof rule.value === "string" ? rule.value.trim() : "";
    if (!field || !value || seen.has(field)) continue;
    seen.add(field);
    cleaned.push({ field, value });
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

/** Append field equality params for Bugzilla `GET /rest/bug`. */
export function appendFilterParams(
  params: URLSearchParams,
  rules: FilterRule[] | undefined,
): void {
  for (const rule of cleanFilterRules(rules)) {
    params.append(bugzillaNameForKey(rule.field), rule.value);
  }
}
