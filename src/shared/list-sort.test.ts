import { describe, expect, it } from "vitest";
import { nextSort, parseListSorts, sortBugs } from "./list-sort.js";
import type { Bug } from "./types.js";

function bug(id: number, fields: Partial<Bug> = {}): Bug {
  return {
    id,
    summary: "",
    status: "",
    resolution: "",
    product: "Widget",
    component: "",
    priority: "",
    severity: "",
    assignedTo: "",
    creator: "",
    creationTime: "",
    lastChangeTime: "",
    description: "",
    keywords: [],
    platform: "",
    version: "",
    ...fields,
  };
}

const ids = (bugs: Bug[]) => bugs.map(({ id }) => id);

describe("list sort", () => {
  it("leaves the order untouched without a sort", () => {
    const bugs = [bug(3), bug(1), bug(2)];
    expect(sortBugs(bugs, undefined)).toBe(bugs);
  });

  it("sorts ids numerically in both directions", () => {
    const bugs = [bug(10), bug(2), bug(33)];
    expect(ids(sortBugs(bugs, { column: "id", direction: "asc" }))).toEqual([
      2, 10, 33,
    ]);
    expect(ids(sortBugs(bugs, { column: "id", direction: "desc" }))).toEqual([
      33, 10, 2,
    ]);
  });

  it("sorts text naturally and case-insensitively", () => {
    const bugs = [
      bug(1, { priority: "P10" }),
      bug(2, { priority: "p2" }),
      bug(3, { priority: "P1" }),
    ];
    expect(
      ids(sortBugs(bugs, { column: "priority", direction: "asc" })),
    ).toEqual([3, 2, 1]);
  });

  it("sorts dates chronologically", () => {
    const bugs = [
      bug(1, { lastChangeTime: "2026-03-01T00:00:00Z" }),
      bug(2, { lastChangeTime: "2025-12-31T00:00:00Z" }),
      bug(3, { lastChangeTime: "2026-01-15T00:00:00Z" }),
    ];
    expect(
      ids(sortBugs(bugs, { column: "lastChangeTime", direction: "desc" })),
    ).toEqual([1, 3, 2]);
  });

  it("sorts assignees by display name", () => {
    const bugs = [
      bug(1, { assignedTo: "a@example.com", assignedToName: "Zed" }),
      bug(2, { assignedTo: "z@example.com", assignedToName: "Amy" }),
    ];
    expect(
      ids(sortBugs(bugs, { column: "assignedTo", direction: "asc" })),
    ).toEqual([2, 1]);
  });

  it("sorts custom fields and keeps empty values last", () => {
    const bugs = [
      bug(1, { extraFields: { cf_team: "Core" } }),
      bug(2),
      bug(3, { extraFields: { cf_team: "---" } }),
      bug(4, { extraFields: { cf_team: "Apps" } }),
    ];
    expect(ids(sortBugs(bugs, { column: "cf_team", direction: "asc" }))).toEqual(
      [4, 1, 2, 3],
    );
    expect(
      ids(sortBugs(bugs, { column: "cf_team", direction: "desc" })),
    ).toEqual([1, 4, 2, 3]);
  });

  it("keeps original order for ties", () => {
    const bugs = [
      bug(5, { status: "NEW" }),
      bug(1, { status: "NEW" }),
      bug(3, { status: "NEW" }),
    ];
    expect(
      ids(sortBugs(bugs, { column: "status", direction: "desc" })),
    ).toEqual([5, 1, 3]);
  });

  it("cycles ascending, descending, then unsorted", () => {
    const asc = nextSort(undefined, "status");
    expect(asc).toEqual({ column: "status", direction: "asc" });
    const desc = nextSort(asc, "status");
    expect(desc).toEqual({ column: "status", direction: "desc" });
    expect(nextSort(desc, "status")).toBeUndefined();
    expect(nextSort(desc, "priority")).toEqual({
      column: "priority",
      direction: "asc",
    });
  });

  it("drops invalid saved sorts", () => {
    expect(parseListSorts(null)).toEqual({});
    expect(parseListSorts([])).toEqual({});
    expect(
      parseListSorts({
        Widget: { column: "priority", direction: "desc" },
        Gadget: { column: "status", direction: "sideways" },
        Gizmo: { column: "", direction: "asc" },
        Other: "nope",
      }),
    ).toEqual({ Widget: { column: "priority", direction: "desc" } });
  });
});
