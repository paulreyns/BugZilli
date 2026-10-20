import { describe, expect, it } from "vitest";
import {
  boardStatusesForDisplay,
  CLOSED_BOARD_STATUS,
  defaultBoardStatuses,
  groupBugsByBoardStatus,
  resolveBoardStatuses,
} from "./board-statuses.js";
import type { Bug } from "./types.js";

function bug(id: number, status: string): Bug {
  return {
    id,
    summary: `Bug ${id}`,
    status,
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
      [bug(1, "NEW"), bug(2, "CUSTOM"), bug(3, "new")],
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
      [bug(1, "CLOSED"), bug(2, "NEW")],
      undefined,
      false,
    );
    expect(columns.some(({ status }) => status === "CLOSED")).toBe(false);
    expect(columns.flatMap(({ bugs }) => bugs).map((b) => b.id)).toEqual([2]);
  });

  it("includes the CLOSED column when show closed is on", () => {
    const columns = groupBugsByBoardStatus(
      [bug(1, "CLOSED")],
      undefined,
      true,
    );
    expect(columns.map(({ status }) => status)).toContain("CLOSED");
    expect(columns.find(({ status }) => status === "CLOSED")?.bugs).toHaveLength(
      1,
    );
  });
});
