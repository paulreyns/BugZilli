import { describe, expect, it } from "vitest";
import {
  boardGroupByFields,
  boardStatusesForDisplay,
  CLOSED_BOARD_STATUS,
  DEFAULT_BOARD_GROUP_BY,
  defaultBoardStatuses,
  defaultColumnsForGroupBy,
  groupBugsByBoard,
  groupBugsByBoardStatus,
  isBoardGroupByField,
  resolveBoardGroupBy,
  resolveBoardStatuses,
} from "./board-statuses.js";
import type { Bug, DetailFieldOption } from "./types.js";

function bug(id: number, overrides: Partial<Bug> = {}): Bug {
  return {
    id,
    summary: `Bug ${id}`,
    status: "NEW",
    resolution: "",
    product: "Test",
    component: "Core",
    priority: "P2",
    severity: "normal",
    assignedTo: "dev@example.com",
    creator: "reporter@example.com",
    creationTime: "2026-01-01T00:00:00Z",
    lastChangeTime: "2026-01-02T00:00:00Z",
    description: "",
    keywords: [],
    platform: "All",
    version: "unspecified",
    ...overrides,
  };
}

describe("board statuses", () => {
  it("defaults to the standard Bugzilla status workflow", () => {
    expect(defaultBoardStatuses()).toEqual([
      "UNCONFIRMED",
      "NEW",
      "ASSIGNED",
      "REOPENED",
      "RESOLVED",
      "VERIFIED",
      "CLOSED",
    ]);
  });

  it("falls back to defaults for missing or empty config", () => {
    expect(resolveBoardStatuses(undefined)).toEqual(defaultBoardStatuses());
    expect(resolveBoardStatuses([])).toEqual(defaultBoardStatuses());
  });

  it("preserves configured order, drops blanks/duplicates, and fills missing defaults", () => {
    expect(
      resolveBoardStatuses([
        "CLOSED",
        "",
        "NEW",
        "closed",
        "  ASSIGNED  ",
      ]),
    ).toEqual([
      "CLOSED",
      "NEW",
      "ASSIGNED",
      "UNCONFIRMED",
      "REOPENED",
      "RESOLVED",
      "VERIFIED",
    ]);
  });

  it("hides the CLOSED column unless show closed bugs is enabled", () => {
    expect(boardStatusesForDisplay(undefined, false)).not.toContain(
      CLOSED_BOARD_STATUS,
    );
    expect(boardStatusesForDisplay(undefined, true)).toContain(
      CLOSED_BOARD_STATUS,
    );
    expect(
      boardStatusesForDisplay(["NEW", "CLOSED", "ASSIGNED"], false),
    ).toEqual([
      "NEW",
      "ASSIGNED",
      "UNCONFIRMED",
      "REOPENED",
      "RESOLVED",
      "VERIFIED",
    ]);
  });

  it("shows empty columns for configured statuses and appends unexpected ones", () => {
    const columns = groupBugsByBoardStatus(
      [bug(1, { status: "NEW" }), bug(2, { status: "CUSTOM" }), bug(3, { status: "new" })],
      ["NEW", "ASSIGNED"],
      false,
    );

    expect(columns.map(({ status }) => status)).toEqual([
      "NEW",
      "ASSIGNED",
      "UNCONFIRMED",
      "REOPENED",
      "RESOLVED",
      "VERIFIED",
      "CUSTOM",
    ]);
    expect(columns.find(({ status }) => status === "NEW")?.bugs.map((b) => b.id)).toEqual([
      1, 3,
    ]);
    expect(columns.find(({ status }) => status === "ASSIGNED")?.bugs).toEqual([]);
    expect(columns.find(({ status }) => status === "CUSTOM")?.bugs.map((b) => b.id)).toEqual([
      2,
    ]);
    expect(columns.some(({ status }) => status === "CLOSED")).toBe(false);
  });

  it("omits CLOSED bugs and column when show closed is off", () => {
    const columns = groupBugsByBoardStatus(
      [bug(1, { status: "CLOSED" }), bug(2, { status: "NEW" })],
      undefined,
      false,
    );
    expect(columns.some(({ status }) => status === "CLOSED")).toBe(false);
    expect(columns.flatMap(({ bugs }) => bugs).map((b) => b.id)).toEqual([2]);
  });

  it("includes the CLOSED column when show closed is on", () => {
    const columns = groupBugsByBoardStatus(
      [bug(1, { status: "CLOSED" })],
      undefined,
      true,
    );
    expect(columns.map(({ status }) => status)).toContain("CLOSED");
    expect(columns.find(({ status }) => status === "CLOSED")?.bugs).toHaveLength(
      1,
    );
  });
});

describe("board group-by field", () => {
  it("defaults group-by to status", () => {
    expect(resolveBoardGroupBy(undefined)).toBe(DEFAULT_BOARD_GROUP_BY);
    expect(resolveBoardGroupBy("")).toBe(DEFAULT_BOARD_GROUP_BY);
    expect(resolveBoardGroupBy("  priority  ")).toBe("priority");
  });

  it("uses built-in select lists for known non-status fields", () => {
    expect(defaultColumnsForGroupBy("priority")).toEqual([
      "--",
      "P1",
      "P2",
      "P3",
      "P4",
      "P5",
    ]);
    expect(defaultColumnsForGroupBy("unknown_field")).toEqual([]);
  });

  it("only accepts select fields that have defined values", () => {
    expect(
      isBoardGroupByField({
        key: "priority",
        label: "Priority",
        type: "select",
        values: ["P1", "P2"],
      }),
    ).toBe(true);
    expect(
      isBoardGroupByField({
        key: "summary",
        label: "Summary",
        type: "text",
      }),
    ).toBe(false);
    expect(
      isBoardGroupByField({
        key: "cf_tags",
        label: "Tags",
        type: "multiselect",
        values: ["a", "b"],
      }),
    ).toBe(false);
    expect(
      isBoardGroupByField({
        key: "status",
        label: "Status",
      }),
    ).toBe(true);
  });

  it("filters a catalog down to board group-by candidates", () => {
    const catalog: DetailFieldOption[] = [
      { key: "summary", label: "Summary", type: "text" },
      { key: "priority", label: "Priority", type: "select", values: ["P1"] },
      { key: "cf_tags", label: "Tags", type: "multiselect", values: ["a"] },
      { key: "cf_team", label: "Team", type: "select", values: ["Alpha", "Beta"] },
    ];
    expect(boardGroupByFields(catalog).map(({ key }) => key)).toEqual([
      "status",
      "priority",
      "cf_team",
    ]);
  });

  it("does not backfill missing defaults for non-status fields", () => {
    expect(resolveBoardStatuses(["P1", "P3"], "priority")).toEqual(["P1", "P3"]);
  });

  it("groups bugs by a non-status field using configured columns", () => {
    const columns = groupBugsByBoard(
      {
        groupBy: "priority",
        columns: ["P1", "P2", "P3"],
        showClosedBugs: false,
      },
      [
        bug(1, { priority: "P1" }),
        bug(2, { priority: "P3" }),
        bug(3, { priority: "P9" }),
        bug(4, { priority: "P1", status: "CLOSED" }),
      ],
    );

    expect(columns.map(({ status }) => status)).toEqual(["P1", "P2", "P3", "P9"]);
    expect(columns.find(({ status }) => status === "P1")?.bugs.map((b) => b.id)).toEqual([
      1,
    ]);
    expect(columns.find(({ status }) => status === "P2")?.bugs).toEqual([]);
    expect(columns.find(({ status }) => status === "P9")?.bugs.map((b) => b.id)).toEqual([
      3,
    ]);
  });

  it("groups bugs by custom select fields stored in extraFields", () => {
    const columns = groupBugsByBoard(
      {
        groupBy: "cf_team",
        columns: ["Alpha", "Beta"],
        showClosedBugs: true,
      },
      [
        bug(1, { extraFields: { cf_team: "Alpha" } }),
        bug(2, { extraFields: { cf_team: "Beta" } }),
        bug(3, {}),
      ],
    );

    expect(columns.map(({ status }) => status)).toEqual([
      "Alpha",
      "Beta",
      "UNKNOWN",
    ]);
    expect(columns.find(({ status }) => status === "UNKNOWN")?.bugs.map((b) => b.id)).toEqual([
      3,
    ]);
  });

  it("keeps CLOSED columns when grouping by a non-status field", () => {
    expect(
      boardStatusesForDisplay(["Alpha", "CLOSED"], false, "cf_team"),
    ).toEqual(["Alpha", "CLOSED"]);
  });
});
