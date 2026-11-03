// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BugComment } from "../../../shared/types";
import { CommentList } from "./CommentsTab";

describe("comment rendering", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(node: ReactNode) {
    await act(async () => {
      root.render(node);
    });
  }

  it("renders lines starting with chevrons as blockquotes", async () => {
    const comments: BugComment[] = [
      {
        id: 1,
        creator: "alice@example.com",
        creatorName: "Alice",
        creationTime: "2026-11-02T13:45:00Z",
        text: "(In reply to Mike)\n> First quoted line\n> Second quoted line\n\nReply text",
        isPrivate: false,
      },
    ];

    await render(<CommentList comments={comments} icon={null} emptyText="None" />);

    const blockquote = container.querySelector("blockquote.comment-blockquote");
    expect(blockquote).not.toBeNull();
    expect(blockquote?.textContent).toBe("First quoted lineSecond quoted line");
    expect(container.textContent).toContain("Reply text");
    expect(container.textContent).toContain("(In reply to Mike)");
    expect(container.querySelectorAll(".comment-blockquote-line")).toHaveLength(2);
  });

  it("renders nested chevron depth and keeps URLs clickable", async () => {
    const comments: BugComment[] = [
      {
        id: 2,
        creator: "alice@example.com",
        creationTime: "2026-11-02T13:45:00Z",
        text: ">> https://example.com/path",
        isPrivate: false,
      },
    ];

    await render(<CommentList comments={comments} icon={null} emptyText="None" />);

    const line = container.querySelector(".comment-blockquote-line");
    expect(line?.getAttribute("data-depth")).toBe("2");
    expect(container.querySelector("blockquote a")?.getAttribute("href")).toBe(
      "https://example.com/path",
    );
  });
});
