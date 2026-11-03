// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BugComment, BugCommentDraft } from "../../../shared/types";
import { CommentsTab, CommentList } from "./CommentsTab";

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
  });

  it("renders nested quotes and keeps URLs clickable", async () => {
    const comments: BugComment[] = [
      {
        id: 2,
        creator: "alice@example.com",
        creationTime: "2026-11-02T13:45:00Z",
        text: ">> https://example.com/path.",
        isPrivate: false,
      },
    ];

    await render(<CommentList comments={comments} icon={null} emptyText="None" />);

    expect(container.querySelectorAll("blockquote")).toHaveLength(2);
    const link = container.querySelector("blockquote a");
    expect(link?.getAttribute("href")).toBe("https://example.com/path");
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  it("renders Bugzilla markdown and leaves raw HTML as text", async () => {
    const comments: BugComment[] = [
      {
        id: 3,
        creator: "alice@example.com",
        creationTime: "2026-11-02T13:45:00Z",
        text: [
          "## Notes",
          "",
          "See **bug 42** and bug 42.",
          "",
          "| Status | Owner |",
          "| --- | --- |",
          "| NEW | Ada |",
          "",
          "<script>alert(1)</script>",
          "",
          "![diagram](https://example.com/diagram.png)",
          "",
          "[click](javascript:alert(1))",
        ].join("\n"),
        isPrivate: false,
      },
    ];

    await render(
      <CommentList
        comments={comments}
        icon={null}
        emptyText="None"
        baseUrl="https://bugs.example.com"
        bugId={7}
      />,
    );

    expect(container.querySelector(".markdown-body h2")?.textContent).toBe("Notes");
    expect(container.querySelector(".markdown-body strong")?.textContent).toBe("bug 42");
    expect(container.querySelector("table")?.textContent).toContain("Ada");
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("alert(1)");
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("diagram");
    expect(container.textContent).toContain("click");
    expect(
      [...container.querySelectorAll("a")].some((link) =>
        (link.getAttribute("href") ?? "").toLowerCase().startsWith("javascript:"),
      ),
    ).toBe(false);
    const bugLink = [...container.querySelectorAll("a")].find((link) =>
      link.textContent?.includes("bug 42"),
    );
    expect(bugLink?.getAttribute("href")).toBe("https://bugs.example.com/show_bug.cgi?id=42");
  });

  it("keeps #[markdown(off)] comments as plain text", async () => {
    const comments: BugComment[] = [
      {
        id: 4,
        creator: "alice@example.com",
        creationTime: "2026-11-02T13:45:00Z",
        text: "#[markdown(off)]\n**not bold**",
        isPrivate: false,
      },
    ];

    await render(<CommentList comments={comments} icon={null} emptyText="None" />);

    expect(container.querySelector(".markdown-body strong")).toBeNull();
    expect(container.querySelector(".markdown-body")?.textContent).toContain("**not bold**");
  });
});

describe("comment editor", () => {
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

  function editor(onSubmit: (comment: BugCommentDraft) => Promise<void> = async () => {}) {
    return (
      <CommentsTab
        hidden={false}
        bugId={7}
        comments={[]}
        disabled={false}
        pending={false}
        baseUrl="https://bugs.example.com"
        onSubmit={onSubmit}
      />
    );
  }

  async function setComment(value: string, start = 0, end = value.length) {
    const textarea = container.querySelector("#bug-comment") as HTMLTextAreaElement;
    await act(async () => {
      textarea.focus();
      textarea.value = value;
      textarea.setSelectionRange(start, end);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("select", { bubbles: true }));
    });
    return textarea;
  }

  it("applies paragraph style, text style, links, lists, quotes, code, and tables", async () => {
    await render(editor());
    const textarea = await setComment("hello");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Bold"]')?.click();
    });
    expect(textarea.value).toBe("**hello**");

    await act(async () => {
      textarea.setSelectionRange(0, textarea.value.length);
      textarea.dispatchEvent(new Event("select", { bubbles: true }));
      const select = container.querySelector<HTMLSelectElement>('select[aria-label="Paragraph style"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(select, "h2");
      select?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(textarea.value).toBe("## **hello**");

    await setComment("note");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Quote"]')?.click();
    });
    expect(textarea.value).toBe("> note");

    await setComment("item");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Bulleted list"]')?.click();
    });
    expect(textarea.value).toBe("- item");

    await setComment("docs", 0, 4);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Link"]')?.click();
    });
    expect(textarea.value).toBe("[docs](url)");

    await setComment("");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Code block"]')?.click();
    });
    expect(textarea.value).toContain("```");

    await setComment("");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Table"]')?.click();
    });
    expect(textarea.value).toContain("| Column 1 | Column 2 |");
    expect(textarea.value).toContain("| --- | --- |");
  });

  it("previews markdown and inserts an emoji", async () => {
    await render(editor());
    const textarea = await setComment("hello");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Bold"]')?.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]')?.click();
    });
    expect(container.querySelector(".comment-preview strong")?.textContent).toBe("hello");

    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
        (button) => button.textContent === "Edit",
      )?.click();
    });
    const emojiButton = container.querySelector<HTMLButtonElement>('button[aria-label="Emoji"]');
    expect(emojiButton).not.toBeNull();
    await act(async () => {
      emojiButton?.click();
    });
    expect(emojiButton?.getAttribute("aria-expanded")).toBe("true");
    const search = container.querySelector<HTMLInputElement>('[aria-label="Search emoji"]');
    expect(search).not.toBeNull();
    await act(async () => {
      if (!search) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(search, "bug");
      search.dispatchEvent(new Event("input", { bubbles: true }));
      search.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="bug"]')?.click();
    });
    expect(textarea.value).toContain("🐛");
  });

  it("submits the markdown comment", async () => {
    const onSubmit = vi.fn(async (_comment: BugCommentDraft) => {});
    await render(editor(onSubmit));
    await setComment("**done**");
    await act(async () => {
      container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledWith({ text: "**done**" });
  });
});
