import type { FavouriteBug } from "./types";

/** Normalize and de-duplicate a favourites list for local settings storage. */
export function cleanFavourites(
  favourites: FavouriteBug[] | undefined,
): FavouriteBug[] | undefined {
  if (!favourites) return undefined;
  if (!Array.isArray(favourites)) return undefined;

  const seen = new Set<number>();
  const cleaned: FavouriteBug[] = [];
  for (const entry of favourites) {
    if (!entry || typeof entry !== "object") continue;
    const id = typeof entry.id === "number" ? entry.id : Number(entry.id);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    const name =
      typeof entry.name === "string" ? entry.name.trim() : "";
    seen.add(id);
    cleaned.push({ id, name: name || `Bug ${id}` });
  }
  return cleaned.length > 0 ? cleaned : undefined;
}

/** True when `bugId` is already in the favourites list. */
export function isFavouriteBug(
  favourites: FavouriteBug[] | undefined,
  bugId: number,
): boolean {
  return (favourites ?? []).some((entry) => entry.id === bugId);
}

/**
 * Add or remove a favourite by id. When adding, `name` is stored for the
 * sidebar label. Returns a new array (or empty when nothing remains).
 */
export function toggleFavouriteBug(
  favourites: FavouriteBug[] | undefined,
  bugId: number,
  name: string,
): FavouriteBug[] {
  const current = favourites ?? [];
  if (current.some((entry) => entry.id === bugId)) {
    return current.filter((entry) => entry.id !== bugId);
  }
  const trimmed = name.trim();
  return [...current, { id: bugId, name: trimmed || `Bug ${bugId}` }];
}

/**
 * Keep a favourited bug's stored name in sync with the live summary
 * (e.g. after an edit). Returns the same array reference when unchanged.
 */
export function syncFavouriteName(
  favourites: FavouriteBug[] | undefined,
  bugId: number,
  name: string,
): FavouriteBug[] | undefined {
  if (!favourites?.length) return favourites;
  const trimmed = name.trim() || `Bug ${bugId}`;
  let changed = false;
  const next = favourites.map((entry) => {
    if (entry.id !== bugId || entry.name === trimmed) return entry;
    changed = true;
    return { ...entry, name: trimmed };
  });
  return changed ? next : favourites;
}
