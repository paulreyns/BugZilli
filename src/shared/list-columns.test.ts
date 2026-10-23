import { describe, expect, it } from "vitest";
import { defaultListColumns, resolveListColumns } from "./list-columns.js";

describe("list columns", () => {
  it("uses the current Issues table as the default", () => {
    expect(defaultListColumns()).toEqual([
      "id",
      "summary",
      "assignedTo",
      "priority",
      "status",
      "lastChangeTime",
    ]);
  });

  it("falls back to defaults for missing or empty config", () => {
    expect(resolveListColumns(undefined)).toEqual(defaultListColumns());
    expect(resolveListColumns([])).toEqual(defaultListColumns());
  });

  it("preserves configured order and drops blanks/duplicates", () => {
    expect(
      resolveListColumns([
        "status",
        "",
        "priority",
        "status",
        "  whiteboard  ",
      ]),
    ).toEqual(["status", "priority", "whiteboard"]);
  });
});
