import { describe, expect, it } from "vitest";
import {
  bugzillaChartNameForKey,
  catalogFromBugRecord,
  defaultDetailFields,
  detailFieldDefinition,
  isExtraDetailField,
  resolveDetailFields,
} from "./detail-fields.js";

describe("detail fields", () => {
  it("uses the current Details layout as the default", () => {
    expect(defaultDetailFields()).toEqual([
      "assignedTo",
      "creator",
      "priority",
      "severity",
      "component",
      "version",
      "platform",
      "creationTime",
      "lastChangeTime",
      "resolution",
      "keywords",
    ]);
  });

  it("falls back to defaults for missing or empty config", () => {
    expect(resolveDetailFields(undefined)).toEqual(defaultDetailFields());
    expect(resolveDetailFields([])).toEqual(defaultDetailFields());
  });

  it("preserves configured order and drops blanks/duplicates", () => {
    expect(
      resolveDetailFields([
        "priority",
        "",
        "component",
        "priority",
        "  whiteboard  ",
      ]),
    ).toEqual(["priority", "component", "whiteboard"]);
  });

  it("labels known fields and humanizes custom ones", () => {
    expect(detailFieldDefinition("assignedTo").label).toBe("Assignee");
    expect(detailFieldDefinition("cf_crash_signature").label).toBe(
      "Crash Signature",
    );
  });

  it("treats uncommon and custom keys as extra detail fields", () => {
    expect(isExtraDetailField("status")).toBe(false);
    expect(isExtraDetailField("assignedTo")).toBe(false);
    expect(isExtraDetailField("keywords")).toBe(false);
    expect(isExtraDetailField("whiteboard")).toBe(true);
    expect(isExtraDetailField("cf_team")).toBe(true);
  });

  it("maps REST field names to Custom Search chart names", () => {
    expect(bugzillaChartNameForKey("status")).toBe("bug_status");
    expect(bugzillaChartNameForKey("summary")).toBe("short_desc");
    expect(bugzillaChartNameForKey("assignedTo")).toBe("assigned_to");
    expect(bugzillaChartNameForKey("severity")).toBe("bug_severity");
    expect(bugzillaChartNameForKey("cf_team")).toBe("cf_team");
  });

  it("builds a catalog from a sample Bugzilla bug payload", () => {
    const catalog = catalogFromBugRecord({
      id: 1,
      summary: "Example",
      product: "Browser",
      status: "NEW",
      assigned_to: "dev@example.com",
      creator: "reporter@example.com",
      priority: "P2",
      severity: "normal",
      component: "UI",
      version: "1.0",
      platform: "All",
      creation_time: "2026-01-01T00:00:00Z",
      last_change_time: "2026-01-02T00:00:00Z",
      resolution: "---",
      keywords: ["regression"],
      whiteboard: "[triaged]",
      cf_blocking: "yes",
      assigned_to_detail: { name: "Dev" },
      depends_on: [2, 3],
    });

    const keys = catalog.map(({ key }) => key);
    expect(keys).toContain("assignedTo");
    expect(keys).toContain("whiteboard");
    expect(keys).toContain("cf_blocking");
    expect(keys).not.toContain("id");
    expect(keys).not.toContain("summary");
    expect(keys).not.toContain("depends_on");
    expect(keys.indexOf("assignedTo")).toBeLessThan(keys.indexOf("whiteboard"));
  });
});
