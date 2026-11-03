import { describe, expect, it } from "vitest";
import {
  applyFormat,
  continueList,
  insertText,
  linkifyPaste,
  paragraphStyleAt,
} from "./comment-format";

describe("comment formatting", () => {
  it("wraps and unwraps bold, italic, strike, and inline code", () => {
    const bold = applyFormat("hello", 0, 5, "bold");
    expect(bold).toEqual({ text: "**hello**", selectionStart: 2, selectionEnd: 7 });
    expect(applyFormat(bold.text, 2, 7, "bold").text).toBe("hello");

    expect(applyFormat("hello", 0, 5, "italic").text).toBe("_hello_");
    expect(applyFormat("hello", 0, 5, "strike").text).toBe("~~hello~~");
    expect(applyFormat("hello", 0, 5, "code").text).toBe("`hello`");
  });

  it("uses a fenced block when code spans lines", () => {
    const result = applyFormat("one\ntwo", 0, 7, "code");
    expect(result.text).toBe("```\none\ntwo\n```");
    expect(applyFormat(result.text, 0, result.text.length, "code-block").text).toBe("one\ntwo");
  });

  it("inserts an empty code block at the cursor", () => {
    const result = applyFormat("Before", 6, 6, "code-block");
    expect(result.text).toBe("Before\n\n```\n\n```");
    expect(result.selectionStart).toBe(result.selectionEnd);
    expect(result.text.slice(result.selectionStart, result.selectionStart + 1)).toBe("\n");
  });

  it("turns a label or a URL into a link and toggles the placeholder off", () => {
    const labeled = applyFormat("docs", 0, 4, "link");
    expect(labeled.text).toBe("[docs](url)");
    expect(labeled.text.slice(labeled.selectionStart, labeled.selectionEnd)).toBe("url");

    const fromUrl = applyFormat("https://example.com", 0, 19, "link");
    expect(fromUrl.text).toBe("[](https://example.com)");
    expect(fromUrl.selectionStart).toBe(1);

    expect(applyFormat("[](url)", 1, 1, "link").text).toBe("");
  });

  it("pastes a URL over selected text as a link", () => {
    const linked = linkifyPaste("docs", 0, 4, "https://example.com/docs");
    expect(linked?.text).toBe("[docs](https://example.com/docs)");
    expect(linkifyPaste("docs", 0, 4, "not a url")).toBeNull();
    expect(linkifyPaste("https://example.com", 0, 19, "https://example.com/other")).toBeNull();
  });

  it("sets paragraph and heading styles and toggles them off", () => {
    expect(applyFormat("Title", 0, 5, "h2").text).toBe("## Title");
    expect(applyFormat("## Title", 3, 3, "h1").text).toBe("# Title");
    expect(applyFormat("## Title", 3, 3, "paragraph").text).toBe("Title");
    expect(applyFormat("- item", 2, 2, "paragraph").text).toBe("- item");
    expect(paragraphStyleAt("## Title", 3)).toBe("h2");
    expect(paragraphStyleAt("plain", 0)).toBe("paragraph");
  });

  it("toggles quotes and lists for the current lines", () => {
    expect(applyFormat("note", 1, 1, "quote").text).toBe("> note");
    expect(applyFormat("> note", 2, 2, "quote").text).toBe("note");

    expect(applyFormat("one\ntwo", 0, 7, "bulleted-list").text).toBe("- one\n- two");
    expect(applyFormat("- one\n- two", 0, 13, "bulleted-list").text).toBe("one\ntwo");
    expect(applyFormat("one\ntwo", 0, 7, "numbered-list").text).toBe("1. one\n2. two");
  });

  it("leaves the caret collapsed so the next character does not replace the line", () => {
    expect(applyFormat("note", 4, 4, "quote")).toEqual({
      text: "> note",
      selectionStart: 6,
      selectionEnd: 6,
    });
    expect(applyFormat("note\n", 5, 5, "bulleted-list")).toEqual({
      text: "note\n- ",
      selectionStart: 7,
      selectionEnd: 7,
    });
    expect(applyFormat("Title", 5, 5, "h2")).toEqual({
      text: "## Title",
      selectionStart: 8,
      selectionEnd: 8,
    });
    const quoted = applyFormat("see the table", 13, 13, "quote");
    const withEmoji = insertText(
      quoted.text,
      quoted.selectionStart,
      quoted.selectionEnd,
      " 🐛",
    );
    expect(withEmoji.text).toBe("> see the table 🐛");
  });

  it("inserts a markdown table and can use the selection as the first heading", () => {
    const table = applyFormat("", 0, 0, "table");
    expect(table.text).toBe("| Column 1 | Column 2 |\n| --- | --- |\n|  |  |");
    expect(table.text.slice(table.selectionStart, table.selectionEnd)).toBe("Column 1");

    const named = applyFormat("Status", 0, 6, "table");
    expect(named.text.startsWith("| Status | Column 2 |")).toBe(true);
    expect(named.text.slice(named.selectionStart, named.selectionEnd)).toBe("Status");
  });

  it("continues a list on enter and leaves the list from an empty item", () => {
    const continued = continueList("- alpha", 7, 7);
    expect(continued?.text).toBe("- alpha\n- ");
    expect(continued?.selectionStart).toBe("- alpha\n- ".length);

    const split = continueList("- alpha", 4, 4);
    expect(split?.text).toBe("- al\n- pha");

    const numbered = continueList("2. beta", 7, 7);
    expect(numbered?.text).toBe("2. beta\n3. ");

    expect(continueList("- ", 2, 2)?.text).toBe("");
    expect(continueList("prev\n- ", 7, 7)?.text).toBe("prev");
    expect(continueList("plain", 5, 5)).toBeNull();
  });

  it("inserts text at the selection", () => {
    expect(insertText("hi", 2, 2, " 👍")).toEqual({
      text: "hi 👍",
      selectionStart: 5,
      selectionEnd: 5,
    });
  });
});
