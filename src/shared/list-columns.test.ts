import { describe, expect, it } from "vitest";
import {
  catalogForListColumns,
  defaultListColumns,
  listColumnDefinition,
  resolveListColumns,
} from "./list-columns.js";

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

  it("labels list-only and known fields", () => {
    expect(listColumnDefinition("id").label).toBe("Key");
    expect(listColumnDefinition("summary").label).toBe("Summary");
    expect(listColumnDefinition("assignedTo").label).toBe("Assignee");
    expect(listColumnDefinition("cf_crash_signature").label).toBe(
      "Crash Signature",
    );
  });

  it("prepends Key and Summary when loading a product catalog", () => {
    const catalog = catalogForListColumns([
      { key: "assignedTo", label: "Assignee" },
      { key: "whiteboard", label: "Whiteboard" },
    ]);
    expect(catalog.map(({ key }) => key)).toEqual([
      "id",
      "summary",
      "assignedTo",
      "whiteboard",
    ]);
  });

  it("does not duplicate Key or Summary if already present", () => {
    const catalog = catalogForListColumns([
      { key: "id", label: "Key" },
      { key: "summary", label: "Summary" },
      { key: "status", label: "Status" },
    ]);
    expect(catalog.map(({ key }) => key)).toEqual(["id", "summary", "status"]);
  });
});
