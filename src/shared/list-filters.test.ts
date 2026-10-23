import { describe, expect, it } from "vitest";
import {
  ALL_FILTER_ID,
  appendFilterParams,
  cleanFilterRules,
  cleanSavedFilters,
  filterDisplayName,
  isOpenResolutionRule,
  normalizeFilterOperator,
  parseSelectedFilters,
  resolveSelectedFilterId,
  rulesForSelectedFilter,
  summarizeRules,
} from "./list-filters.js";

describe("list-filters", () => {
  it("cleans filter rules and drops empty values for value-based operators", () => {
    expect(
      cleanFilterRules([
        { field: " status ", value: " NEW " },
        { field: "status", operator: "notequals", value: "ASSIGNED" },
        { field: "priority", value: "" },
        { field: "", value: "P1" },
        { field: "priority", value: "P1" },
        { field: "summary", operator: "isempty", value: "" },
        { field: "whiteboard", operator: "isnotempty", value: "ignored" },
        { field: "bogus", operator: "nope" as never, value: "x" },
      ]),
    ).toEqual([
      { field: "status", operator: "equals", value: "NEW" },
      { field: "status", operator: "notequals", value: "ASSIGNED" },
      { field: "priority", operator: "equals", value: "P1" },
      { field: "summary", operator: "isempty", value: "" },
      { field: "whiteboard", operator: "isnotempty", value: "" },
      { field: "bogus", operator: "equals", value: "x" },
    ]);
  });

  it("cleans saved filters and omits All / empty rule sets", () => {
    expect(
      cleanSavedFilters([
        { id: ALL_FILTER_ID, name: "All", rules: [] },
        {
          id: " open ",
          name: "  ",
          rules: [{ field: "status", value: "NEW" }],
        },
        { id: "empty", name: "Empty", rules: [] },
        {
          id: "open",
          name: "Dup",
          rules: [{ field: "status", value: "ASSIGNED" }],
        },
      ]),
    ).toEqual([
      {
        id: "open",
        name: "Status equals NEW",
        rules: [{ field: "status", operator: "equals", value: "NEW" }],
      },
    ]);
  });

  it("summarizes and displays filter names with operators", () => {
    expect(
      summarizeRules([
        { field: "status", value: "NEW" },
        { field: "priority", operator: "greaterthan", value: "P3" },
        { field: "summary", operator: "isempty", value: "" },
      ]),
    ).toBe(
      "Status equals NEW · Priority is greater than P3 · Summary is empty",
    );
    expect(
      filterDisplayName({
        id: "1",
        name: "My filter",
        rules: [{ field: "status", value: "NEW" }],
      }),
    ).toBe("My filter");
    expect(
      filterDisplayName({
        id: "1",
        name: "  ",
        rules: [{ field: "status", operator: "anywords", value: "NEW FIXED" }],
      }),
    ).toBe("Status contains any of the words NEW FIXED");
  });

  it("parses selected filters and resolves unknown ids to All", () => {
    expect(parseSelectedFilters({ Browser: "open", Other: 3 })).toEqual({
      Browser: "open",
    });
    expect(resolveSelectedFilterId("missing", [{ id: "open", name: "Open", rules: [{ field: "status", value: "NEW" }] }])).toBe(
      ALL_FILTER_ID,
    );
    expect(
      rulesForSelectedFilter("open", [
        {
          id: "open",
          name: "Open",
          rules: [{ field: "status", value: "NEW" }],
        },
      ]),
    ).toEqual([{ field: "status", value: "NEW" }]);
    expect(rulesForSelectedFilter(ALL_FILTER_ID, [])).toEqual([]);
  });

  it("appends Bugzilla advanced search fN/oN/vN params for filter rules", () => {
    const params = new URLSearchParams();
    appendFilterParams(params, [
      { field: "assignedTo", value: "dev@example.com" },
      { field: "status", operator: "notequals", value: "RESOLVED" },
      { field: "summary", operator: "anywords", value: "crash hang" },
      { field: "whiteboard", operator: "isempty", value: "" },
    ]);
    expect(params.get("f1")).toBe("assigned_to");
    expect(params.get("o1")).toBe("equals");
    expect(params.get("v1")).toBe("dev@example.com");
    expect(params.get("f2")).toBe("bug_status");
    expect(params.get("o2")).toBe("notequals");
    expect(params.get("v2")).toBe("RESOLVED");
    expect(params.get("f3")).toBe("short_desc");
    expect(params.get("o3")).toBe("anywords");
    expect(params.get("v3")).toBe("crash hang");
    expect(params.get("f4")).toBe("status_whiteboard");
    expect(params.get("o4")).toBe("isempty");
    expect(params.has("v4")).toBe(false);
  });

  it("maps ID filters to Bugzilla's bug_id search field", () => {
    const params = new URLSearchParams();
    appendFilterParams(params, [
      { field: "id", operator: "anyexact", value: "123,456" },
    ]);
    expect(params.get("f1")).toBe("bug_id");
    expect(params.get("o1")).toBe("anyexact");
    expect(params.get("v1")).toBe("123,456");
    expect(summarizeRules([{ field: "id", value: "123" }])).toBe(
      "Id equals 123",
    );
  });

  it("normalizes operators and detects open-only resolution rules", () => {
    expect(normalizeFilterOperator(undefined)).toBe("equals");
    expect(normalizeFilterOperator("allwords")).toBe("allwords");
    expect(normalizeFilterOperator("nope")).toBe("equals");
    expect(
      isOpenResolutionRule({
        field: "resolution",
        operator: "equals",
        value: "---",
      }),
    ).toBe(true);
    expect(
      isOpenResolutionRule({
        field: "resolution",
        operator: "notequals",
        value: "---",
      }),
    ).toBe(false);
    expect(
      isOpenResolutionRule({ field: "status", value: "NEW" }),
    ).toBe(false);
  });
});
