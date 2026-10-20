import { describe, expect, it } from "vitest";
import {
  ALL_FILTER_ID,
  appendFilterParams,
  cleanFilterRules,
  cleanSavedFilters,
  filterDisplayName,
  parseSelectedFilters,
  resolveSelectedFilterId,
  rulesForSelectedFilter,
  summarizeRules,
} from "./list-filters.js";

describe("list-filters", () => {
  it("cleans filter rules and drops empty or duplicate fields", () => {
    expect(
      cleanFilterRules([
        { field: " status ", value: " NEW " },
        { field: "status", value: "ASSIGNED" },
        { field: "priority", value: "" },
        { field: "", value: "P1" },
        { field: "priority", value: "P1" },
      ]),
    ).toEqual([
      { field: "status", value: "NEW" },
      { field: "priority", value: "P1" },
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
        name: "Status = NEW",
        rules: [{ field: "status", value: "NEW" }],
      },
    ]);
  });

  it("summarizes and displays filter names", () => {
    expect(
      summarizeRules([
        { field: "status", value: "NEW" },
        { field: "priority", value: "P1" },
      ]),
    ).toBe("Status = NEW · Priority = P1");
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
        rules: [{ field: "status", value: "NEW" }],
      }),
    ).toBe("Status = NEW");
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

  it("appends Bugzilla field names for filter rules", () => {
    const params = new URLSearchParams();
    appendFilterParams(params, [
      { field: "assignedTo", value: "dev@example.com" },
      { field: "status", value: "NEW" },
    ]);
    expect(params.getAll("assigned_to")).toEqual(["dev@example.com"]);
    expect(params.getAll("status")).toEqual(["NEW"]);
  });
});
