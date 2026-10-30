import { describe, expect, it } from "vitest";
import {
  UNASSIGNED_BOARD_COLUMN_ID,
  UNASSIGNED_BOARD_COLUMN_NAME,
  boardGroupByFields,
  boardStatusesForDisplay,
  cleanBoardColumns,
  clearBoardColumnValues,
  CLOSED_BOARD_STATUS,
  DEFAULT_BOARD_GROUP_BY,
  defaultBoardStatuses,
  defaultColumnsForGroupBy,
  groupBugsByBoard,
  groupBugsByBoardStatus,
  groupBugsByMappedBoard,
  isBoardGroupByField,
  moveBoardColumn,
  moveBoardValue,
  resolveBoardGroupBy,
  resolveBoardStatuses,
  resolveUserBoardColumns,
  unassignedBoardValues,
} from "./board-statuses.js";
import type { BoardColumnConfig, Bug, DetailFieldOption } from "./types.js";

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

describe("board column mapping", () => {
  const doing: BoardColumnConfig = {
    id: "doing",
    name: "Doing",
    values: ["ASSIGNED", "REOPENED"],
  };
  const done: BoardColumnConfig = {
    id: "done",
    name: "Done",
    values: ["RESOLVED"],
  };

  it("treats an explicit empty column list as no named columns", () => {
    expect(resolveUserBoardColumns([], ["NEW", "ASSIGNED"], "status")).toEqual(
      [],
    );
  });

  it("turns a legacy status order into one column per value", () => {
    expect(resolveUserBoardColumns(undefined, ["NEW", "ASSIGNED"], "status")).toEqual(
      [
        { id: "legacy:NEW", name: "NEW", values: ["NEW"] },
        { id: "legacy:ASSIGNED", name: "ASSIGNED", values: ["ASSIGNED"] },
        { id: "legacy:UNCONFIRMED", name: "UNCONFIRMED", values: ["UNCONFIRMED"] },
        { id: "legacy:REOPENED", name: "REOPENED", values: ["REOPENED"] },
        { id: "legacy:RESOLVED", name: "RESOLVED", values: ["RESOLVED"] },
        { id: "legacy:VERIFIED", name: "VERIFIED", values: ["VERIFIED"] },
        { id: "legacy:CLOSED", name: "CLOSED", values: ["CLOSED"] },
      ],
    );
  });

  it("leaves values that are not mapped in New", () => {
    expect(
      unassignedBoardValues(
        "status",
        ["NEW", "ASSIGNED", "RESOLVED", "CLOSED"],
        [doing],
      ),
    ).toEqual(["NEW", "RESOLVED", "CLOSED"]);
    expect(
      unassignedBoardValues("status", ["new", "NEW", "ASSIGNED"], [doing]),
    ).toEqual(["new"]);
  });

  it("matches non-status values exactly", () => {
    expect(
      unassignedBoardValues("priority", ["P1", "p1", "P2"], [
        { id: "soon", name: "Soon", values: ["P1"] },
      ]),
    ).toEqual(["p1", "P2"]);
  });

  it("moves a value into a column and back to New", () => {
    const moved = moveBoardValue([doing, done], "status", "NEW", "done", 0);
    expect(moved.find((column) => column.id === "doing")?.values).toEqual([
      "ASSIGNED",
      "REOPENED",
    ]);
    expect(moved.find((column) => column.id === "done")?.values).toEqual([
      "NEW",
      "RESOLVED",
    ]);

    const cleared = moveBoardValue(moved, "status", "new", UNASSIGNED_BOARD_COLUMN_ID);
    expect(cleared.find((column) => column.id === "done")?.values).toEqual([
      "RESOLVED",
    ]);
    expect(
      unassignedBoardValues("status", ["NEW", "ASSIGNED", "REOPENED", "RESOLVED"], cleared),
    ).toEqual(["NEW"]);
  });

  it("drops a value from its old column when it is moved", () => {
    const moved = moveBoardValue([doing, done], "status", "ASSIGNED", "done");
    expect(moved.map((column) => column.values)).toEqual([
      ["REOPENED"],
      ["RESOLVED", "ASSIGNED"],
    ]);
  });

  it("reorders columns without changing their values", () => {
    expect(moveBoardColumn([doing, done], "done", -1).map((column) => column.id)).toEqual([
      "done",
      "doing",
    ]);
    expect(moveBoardColumn([doing, done], "doing", -1)).toEqual([doing, done]);
  });

  it("clears mapped values and keeps column names when the group-by field changes", () => {
    expect(clearBoardColumnValues([doing, done])).toEqual([
      { id: "doing", name: "Doing", values: [] },
      { id: "done", name: "Done", values: [] },
    ]);
  });

  it("cleans blank names, duplicate ids, and duplicate values", () => {
    expect(
      cleanBoardColumns(
        [
          { id: "doing", name: " Doing ", values: [" NEW ", "new", ""] },
          { id: "doing", name: "Other", values: ["ASSIGNED"] },
          { id: UNASSIGNED_BOARD_COLUMN_ID, name: "New", values: ["RESOLVED"] },
          { id: " ", name: "Blank", values: ["P1"] },
          { id: "later", name: "   ", values: ["P2"] },
          { name: "Missing id", values: ["P3"] },
        ],
        "status",
      ),
    ).toEqual([{ id: "doing", name: "Doing", values: ["NEW"] }]);
  });

  it("groups bugs into named columns and leaves unmapped bugs in New", () => {
    const columns = groupBugsByMappedBoard(
      [
        bug(1, { status: "ASSIGNED" }),
        bug(2, { status: "REOPENED" }),
        bug(3, { status: "NEW" }),
        bug(4, { status: "assigned" }),
      ],
      { groupBy: "status", columns: [doing, done], showClosedBugs: false },
    );

    expect(columns.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: UNASSIGNED_BOARD_COLUMN_ID, name: UNASSIGNED_BOARD_COLUMN_NAME },
      { id: "doing", name: "Doing" },
      { id: "done", name: "Done" },
    ]);
    expect(columns.find((column) => column.id === "doing")?.bugs.map((entry) => entry.id)).toEqual([
      1, 2, 4,
    ]);
    expect(columns.find((column) => column.id === "done")?.bugs).toEqual([]);
    expect(
      columns.find((column) => column.unassigned)?.bugs.map((entry) => entry.id),
    ).toEqual([3]);
  });

  it("hides New when every visible bug is mapped", () => {
    const columns = groupBugsByMappedBoard([bug(1, { status: "ASSIGNED" })], {
      columns: [doing],
      showClosedBugs: false,
    });
    expect(columns.map((column) => column.name)).toEqual(["Doing"]);
  });

  it("shows an empty New column when the user has not named any columns", () => {
    const columns = groupBugsByMappedBoard([], {
      columns: [],
      showClosedBugs: false,
    });
    expect(columns).toEqual([
      {
        id: UNASSIGNED_BOARD_COLUMN_ID,
        name: UNASSIGNED_BOARD_COLUMN_NAME,
        values: [],
        bugs: [],
        unassigned: true,
      },
    ]);
  });

  it("hides a status column that only contains Closed until closed bugs are shown", () => {
    const closed: BoardColumnConfig = {
      id: "closed",
      name: "Finished",
      values: ["CLOSED"],
    };
    const hidden = groupBugsByMappedBoard(
      [bug(1, { status: "CLOSED" }), bug(2, { status: "ASSIGNED" })],
      { columns: [doing, closed], showClosedBugs: false },
    );
    expect(hidden.map((column) => column.name)).toEqual(["Doing"]);
    expect(hidden.flatMap((column) => column.bugs).map((entry) => entry.id)).toEqual([
      2,
    ]);

    const shown = groupBugsByMappedBoard([bug(1, { status: "CLOSED" })], {
      columns: [closed],
      showClosedBugs: true,
    });
    expect(shown.map((column) => column.name)).toEqual(["Finished"]);
    expect(shown[0]?.bugs).toHaveLength(1);
  });

  it("keeps a column that mixes Closed with another status", () => {
    const mixed: BoardColumnConfig = {
      id: "done",
      name: "Done",
      values: ["RESOLVED", "CLOSED"],
    };
    const columns = groupBugsByMappedBoard(
      [
        bug(1, { status: "RESOLVED" }),
        bug(2, { status: "CLOSED" }),
      ],
      { columns: [mixed], showClosedBugs: false },
    );
    expect(columns.map((column) => column.name)).toEqual(["Done"]);
    expect(columns[0]?.bugs.map((entry) => entry.id)).toEqual([1]);
  });

  it("does not hide a non-status column whose value is CLOSED", () => {
    const columns = groupBugsByMappedBoard(
      [bug(1, { priority: "CLOSED", status: "NEW" })],
      {
        groupBy: "priority",
        columns: [{ id: "team", name: "Team", values: ["CLOSED"] }],
        showClosedBugs: false,
      },
    );
    expect(columns.map((column) => column.name)).toEqual(["Team"]);
    expect(columns[0]?.bugs.map((entry) => entry.id)).toEqual([1]);
  });

  it("puts several group-by values in one named column", () => {
    const columns = groupBugsByMappedBoard(
      [
        bug(1, { priority: "P1" }),
        bug(2, { priority: "P2" }),
        bug(3, { priority: "P5" }),
        bug(4, { priority: "P1", status: "CLOSED" }),
      ],
      {
        groupBy: "priority",
        columns: [
          { id: "soon", name: "Soon", values: ["P1", "P2"] },
          { id: "later", name: "Later", values: [] },
        ],
        showClosedBugs: false,
      },
    );

    expect(columns.map((column) => column.name)).toEqual(["New", "Soon", "Later"]);
    expect(columns.find((column) => column.name === "Soon")?.bugs.map((entry) => entry.id)).toEqual([
      1, 2,
    ]);
    expect(columns.find((column) => column.name === "Later")?.bugs).toEqual([]);
    expect(columns.find((column) => column.unassigned)?.bugs.map((entry) => entry.id)).toEqual([
      3,
    ]);
  });
});
