import { describe, expect, it } from "vitest";
import {
  buildBugUpdate,
  draftFromBug,
  validateBugDraft,
  type BugDraft,
} from "../shared/bug-update.js";
import type { Bug } from "../shared/types.js";

const bug: Bug = {
  id: 42,
  summary: "Toolbar is clipped",
  status: "NEW",
  resolution: "",
  product: "Browser",
  component: "UI",
  priority: "P3",
  severity: "normal",
  assignedTo: "dev@example.com",
  creator: "reporter@example.com",
  creationTime: "2026-10-01T00:00:00Z",
  lastChangeTime: "2026-10-02T00:00:00Z",
  description: "Steps",
  keywords: ["crash"],
  platform: "All",
  version: "unspecified",
};

function draft(values: Partial<BugDraft> = {}): BugDraft {
  return { ...draftFromBug(bug), ...values };
}

describe("bug update drafts", () => {
  it("sends only the fields that changed", () => {
    expect(buildBugUpdate(bug, draft({ summary: "  Toolbar clips  " }))).toEqual({
      summary: "Toolbar clips",
    });
    expect(buildBugUpdate(bug, draft({ keywords: "crash, regression" }))).toEqual({
      keywords: ["crash", "regression"],
    });
    expect(validateBugDraft(bug, draft())).toBe("Change a field before saving.");
  });

  it("requires a resolution when closing and omits it when reopening", () => {
    expect(validateBugDraft(bug, draft({ status: "RESOLVED" }))).toBe(
      "Choose a resolution before closing this bug.",
    );
    expect(
      buildBugUpdate(bug, draft({ status: "RESOLVED", resolution: "FIXED" })),
    ).toEqual({
      status: "RESOLVED",
      resolution: "FIXED",
    });

    const closed: Bug = { ...bug, status: "RESOLVED", resolution: "FIXED" };
    expect(
      buildBugUpdate(closed, {
        ...draftFromBug(closed),
        status: "REOPENED",
        resolution: "",
      }),
    ).toEqual({ status: "REOPENED" });
    expect(
      validateBugDraft(closed, {
        ...draftFromBug(closed),
        status: "REOPENED",
        resolution: "FIXED",
      }),
    ).toBe("Clear the resolution before saving an open bug.");
  });

  it("treats an unchanged keyword list as no edit", () => {
    expect(buildBugUpdate(bug, draft({ keywords: " crash " }))).toEqual({});
    expect(validateBugDraft(bug, draft({ summary: "   " }))).toBe(
      "Summary cannot be empty.",
    );
  });
});
