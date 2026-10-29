import { describe, expect, it } from "vitest";
import {
  defaultLinkedColumns,
  resolveLinkedColumns,
} from "./linked-columns.js";

describe("linked columns", () => {
  it("uses the current Linked Bugs table as the default", () => {
    expect(defaultLinkedColumns()).toEqual(["id", "summary", "assignedTo"]);
  });

  it("falls back to defaults for missing or empty config", () => {
    expect(resolveLinkedColumns(undefined)).toEqual(defaultLinkedColumns());
    expect(resolveLinkedColumns([])).toEqual(defaultLinkedColumns());
  });

  it("preserves configured order and drops blanks/duplicates", () => {
    expect(
      resolveLinkedColumns([
        "status",
        "",
        "priority",
        "status",
        "  whiteboard  ",
      ]),
    ).toEqual(["status", "priority", "whiteboard"]);
  });
});
