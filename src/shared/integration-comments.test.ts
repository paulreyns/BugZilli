import { describe, expect, it } from "vitest";
import { splitIntegrationComments } from "./integration-comments";
import type { BugComment } from "./types";

function comment(id: number, creator: string): BugComment {
  return { id, creator, creationTime: "", text: `comment ${id}`, isPrivate: false };
}

describe("splitIntegrationComments", () => {
  const comments = [
    comment(1, "dev@example.com"),
    comment(2, "CI-Bot@example.com"),
    comment(3, "qa@example.com"),
    comment(4, "ci-bot@example.com"),
  ];

  it("keeps every comment in the main list when no integration user is set", () => {
    for (const user of [undefined, "", "   "]) {
      expect(splitIntegrationComments(comments, user)).toEqual({
        comments,
        integrations: [],
      });
    }
  });

  it("moves the integration user's comments out of the main list, preserving order", () => {
    const result = splitIntegrationComments(comments, " ci-bot@EXAMPLE.com ");
    expect(result.comments.map(({ id }) => id)).toEqual([1, 3]);
    expect(result.integrations.map(({ id }) => id)).toEqual([2, 4]);
  });
});
