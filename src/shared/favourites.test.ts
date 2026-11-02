import { describe, expect, it } from "vitest";
import {
  cleanFavourites,
  isFavouriteBug,
  syncFavouriteName,
  toggleFavouriteBug,
} from "./favourites";

describe("cleanFavourites", () => {
  it("returns undefined for empty or missing lists", () => {
    expect(cleanFavourites(undefined)).toBeUndefined();
    expect(cleanFavourites([])).toBeUndefined();
  });

  it("keeps valid id/name pairs and drops duplicates and junk", () => {
    expect(
      cleanFavourites([
        { id: 12, name: "  Crash on save  " },
        { id: 12, name: "Duplicate" },
        { id: 0, name: "Bad id" },
        { id: -3, name: "Also bad" },
        { id: 44, name: "   " },
        { id: Number.NaN, name: "NaN" },
      ]),
    ).toEqual([
      { id: 12, name: "Crash on save" },
      { id: 44, name: "Bug 44" },
    ]);
  });
});

describe("isFavouriteBug", () => {
  it("reports whether a bug id is favourited", () => {
    const favourites = [{ id: 7, name: "One" }];
    expect(isFavouriteBug(favourites, 7)).toBe(true);
    expect(isFavouriteBug(favourites, 8)).toBe(false);
    expect(isFavouriteBug(undefined, 7)).toBe(false);
  });
});

describe("toggleFavouriteBug", () => {
  it("adds a favourite when missing", () => {
    expect(toggleFavouriteBug([], 9, "  New bug  ")).toEqual([
      { id: 9, name: "New bug" },
    ]);
  });

  it("removes a favourite when present", () => {
    expect(
      toggleFavouriteBug(
        [
          { id: 1, name: "A" },
          { id: 2, name: "B" },
        ],
        1,
        "Ignored",
      ),
    ).toEqual([{ id: 2, name: "B" }]);
  });

  it("falls back to Bug N when the name is blank", () => {
    expect(toggleFavouriteBug(undefined, 3, "  ")).toEqual([
      { id: 3, name: "Bug 3" },
    ]);
  });
});

describe("syncFavouriteName", () => {
  it("updates the stored name for a matching favourite", () => {
    const favourites = [
      { id: 1, name: "Old" },
      { id: 2, name: "Keep" },
    ];
    expect(syncFavouriteName(favourites, 1, "  Renamed  ")).toEqual([
      { id: 1, name: "Renamed" },
      { id: 2, name: "Keep" },
    ]);
  });

  it("returns the same array when nothing changes", () => {
    const favourites = [{ id: 1, name: "Same" }];
    expect(syncFavouriteName(favourites, 1, "Same")).toBe(favourites);
    expect(syncFavouriteName(favourites, 99, "Other")).toBe(favourites);
    expect(syncFavouriteName(undefined, 1, "X")).toBeUndefined();
  });
});
