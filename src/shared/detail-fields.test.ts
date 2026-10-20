import { describe, expect, it } from "vitest";
import {
  bugzillaChartNameForKey,
  catalogFromBugRecord,
  catalogFromFieldApi,
  defaultDetailFields,
  detailFieldDefinition,
  detailFieldTypeFromBugzilla,
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
    expect(isExtraDetailField("product")).toBe(false);
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

  it("maps Bugzilla field type integers", () => {
    expect(detailFieldTypeFromBugzilla(1)).toBe("text");
    expect(detailFieldTypeFromBugzilla(2)).toBe("select");
    expect(detailFieldTypeFromBugzilla(3)).toBe("multiselect");
    expect(detailFieldTypeFromBugzilla(4)).toBe("textarea");
    expect(detailFieldTypeFromBugzilla(9)).toBe("date");
    expect(detailFieldTypeFromBugzilla(10)).toBe("integer");
    expect(detailFieldTypeFromBugzilla(99)).toBe("unknown");
  });

  it("builds a catalog from /rest/field/bug with product-filtered values", () => {
    const catalog = catalogFromFieldApi(
      [
        {
          name: "summary",
          display_name: "Summary",
          type: 1,
        },
        {
          name: "assigned_to",
          display_name: "Assignee",
          type: 1,
        },
        {
          name: "whiteboard",
          display_name: "Whiteboard",
          type: 1,
        },
        {
          name: "cf_blocking",
          display_name: "Blocking",
          type: 2,
          values: [
            { name: "yes", sort_key: 1 },
            { name: "no", sort_key: 2 },
          ],
        },
        {
          name: "cf_browser_only",
          display_name: "Browser Only",
          type: 1,
          visibility_field: "product",
          visibility_values: ["Browser"],
        },
        {
          name: "cf_mobile_only",
          display_name: "Mobile Only",
          type: 1,
          visibility_field: "product",
          visibility_values: ["Mobile"],
        },
        {
          name: "component",
          display_name: "Component",
          type: 2,
          value_field: "product",
          values: [
            {
              name: "UI",
              sort_key: 1,
              visibility_values: ["Browser"],
              is_active: true,
            },
            {
              name: "Networking",
              sort_key: 2,
              visibility_values: ["Browser"],
              is_active: true,
            },
            {
              name: "Android",
              sort_key: 1,
              visibility_values: ["Mobile"],
              is_active: true,
            },
            {
              name: "Retired",
              sort_key: 3,
              visibility_values: ["Browser"],
              is_active: false,
            },
          ],
        },
        {
          name: "depends_on",
          display_name: "Depends On",
          type: 6,
        },
      ],
      "Browser",
    );

    const byKey = new Map(catalog.map((option) => [option.key, option]));
    expect(byKey.has("summary")).toBe(false);
    expect(byKey.has("depends_on")).toBe(false);
    expect(byKey.get("assignedTo")?.label).toBe("Assignee");
    expect(byKey.get("whiteboard")).toMatchObject({
      label: "Whiteboard",
      type: "text",
    });
    expect(byKey.get("cf_blocking")).toMatchObject({
      label: "Blocking",
      type: "select",
      values: ["yes", "no"],
    });
    expect(byKey.has("cf_browser_only")).toBe(true);
    expect(byKey.has("cf_mobile_only")).toBe(false);
    expect(byKey.get("component")?.values).toEqual(["UI", "Networking"]);
  });
});
