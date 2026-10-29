import { describe, expect, it } from "vitest";
import {
  addBugFieldKeys,
  buildBugCreate,
  bugCreateErrorSummary,
  emptyBugCreate,
  fieldsForCreateError,
  isCreateFieldRequired,
  validateBugCreate,
  writeCreateField,
} from "./bug-create.js";
import type { DetailFieldOption } from "./types.js";

const options = new Map<string, DetailFieldOption>([
  ["component", { key: "component", label: "Component", required: true }],
  ["version", { key: "version", label: "Version", required: true }],
  ["priority", { key: "priority", label: "Priority", required: true }],
  ["cf_blocking", { key: "cf_blocking", label: "Blocking", type: "select", required: true }],
  ["whiteboard", { key: "whiteboard", label: "Whiteboard", type: "text" }],
]);

function filledDraft() {
  const draft = emptyBugCreate([
    "status",
    "component",
    "version",
    "priority",
    "cf_blocking",
    "whiteboard",
  ]);
  return {
    ...draft,
    summary: "Toolbar clips",
    description: "Steps to reproduce",
    component: "UI",
    version: "1.0",
    priority: "P2",
    status: "NEW",
    extraFields: { ...draft.extraFields, cf_blocking: "yes", whiteboard: "triage" },
  };
}

describe("add bug form", () => {
  it("matches the detail editor field list and includes status", () => {
    expect(addBugFieldKeys(undefined)).toContain("status");
    expect(addBugFieldKeys(["priority", "component"])).toEqual([
      "status",
      "priority",
      "component",
    ]);
    expect(addBugFieldKeys(["status", "severity"])).toEqual(["status", "severity"]);
  });

  it("marks Bugzilla-required fields and configured mandatory fields", () => {
    expect(isCreateFieldRequired("summary", undefined, "")).toBe(true);
    expect(isCreateFieldRequired("component", undefined, "")).toBe(true);
    expect(isCreateFieldRequired("version", undefined, "")).toBe(true);
    expect(isCreateFieldRequired("priority", options.get("priority"), "")).toBe(true);
    expect(isCreateFieldRequired("whiteboard", options.get("whiteboard"), "")).toBe(false);
    expect(isCreateFieldRequired("creator", { key: "creator", label: "Reporter", required: true }, "")).toBe(
      false,
    );
    expect(isCreateFieldRequired("resolution", undefined, "NEW")).toBe(false);
    expect(isCreateFieldRequired("resolution", undefined, "RESOLVED")).toBe(true);
  });

  it("reports every empty required field", () => {
    const draft = emptyBugCreate(["component", "version", "priority", "cf_blocking"]);
    const issues = validateBugCreate(
      draft,
      ["status", "component", "version", "priority", "cf_blocking"],
      options,
    );
    expect(issues.summary).toBe("Summary is required.");
    expect(issues.component).toBe("Component is required.");
    expect(issues.version).toBe("Version is required.");
    expect(issues.priority).toBe("Priority is required.");
    expect(issues.cf_blocking).toBe("Blocking is required.");
    expect(issues.status).toBeUndefined();
    expect(bugCreateErrorSummary(issues)).toBe("Some fields need attention.");
  });

  it("requires a resolution only when the bug is being closed", () => {
    const open = validateBugCreate(
      { ...filledDraft(), resolution: "FIXED" },
      ["resolution"],
      options,
    );
    expect(open.resolution).toMatch(/open bug/);

    const closed = validateBugCreate(
      { ...filledDraft(), status: "RESOLVED", resolution: "" },
      ["resolution"],
      options,
    );
    expect(closed.resolution).toMatch(/resolution/);
  });

  it("clears the resolution when the status becomes open", () => {
    const next = writeCreateField(
      { ...filledDraft(), status: "RESOLVED", resolution: "FIXED" },
      "status",
      "NEW",
    );
    expect(next.status).toBe("NEW");
    expect(next.resolution).toBe("");
  });

  it("posts filled values and omits blanks", () => {
    const body = buildBugCreate(
      "Browser",
      {
        ...filledDraft(),
        keywords: "regression, crash",
        assignedTo: "dev@example.com",
        platform: "All",
      },
      { cf_blocking: "select", cf_flags: "multiselect" },
    );
    const withFlags = buildBugCreate(
      "Browser",
      writeCreateField(
        { ...filledDraft(), keywords: "regression, crash" },
        "cf_flags",
        "a, b",
      ),
      { cf_flags: "multiselect" },
    );

    expect(body).toMatchObject({
      product: "Browser",
      summary: "Toolbar clips",
      description: "Steps to reproduce",
      component: "UI",
      version: "1.0",
      priority: "P2",
      status: "NEW",
      assigned_to: "dev@example.com",
      platform: "All",
      keywords: ["regression", "crash"],
      whiteboard: "triage",
      cf_blocking: "yes",
    });
    expect(body).not.toHaveProperty("resolution");
    expect(withFlags.cf_flags).toEqual(["a", "b"]);
  });

  it("does not send a resolution for an open bug", () => {
    const body = buildBugCreate("Browser", {
      ...filledDraft(),
      status: "NEW",
      resolution: "FIXED",
    });
    expect(body).not.toHaveProperty("resolution");
    expect(
      buildBugCreate("Browser", {
        ...filledDraft(),
        status: "RESOLVED",
        resolution: "FIXED",
      }).resolution,
    ).toBe("FIXED");
  });

  it("maps Bugzilla error text onto the fields it names", () => {
    const keys = ["summary", "component", "version", "severity", "cf_blocking", "description"];
    const catalog: DetailFieldOption[] = [
      { key: "cf_blocking", label: "Blocking", required: true },
      { key: "severity", label: "Severity" },
    ];
    expect(fieldsForCreateError("You must select/enter a component.", keys, catalog)).toEqual([
      "component",
    ]);
    expect(
      fieldsForCreateError("A value must be set for the 'cf_blocking' field.", keys, catalog),
    ).toEqual(["cf_blocking"]);
    expect(fieldsForCreateError("'normal' is not a valid bug_severity.", keys, catalog)).toEqual([
      "severity",
    ]);
    expect(fieldsForCreateError("You must enter a summary for this bug.", keys, catalog)).toEqual([
      "summary",
    ]);
    expect(fieldsForCreateError("Description is required.", keys, catalog)).toEqual([
      "description",
    ]);
    expect(fieldsForCreateError("Invalid API key.", keys, catalog)).toEqual([]);
    expect(
      fieldsForCreateError("status_whiteboard must be shorter.", ["status", "whiteboard"], [
        { key: "status", label: "Status" },
        { key: "whiteboard", label: "Whiteboard" },
      ]),
    ).toEqual(["whiteboard"]);
  });
});
