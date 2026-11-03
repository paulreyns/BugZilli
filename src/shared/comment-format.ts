export interface FormatResult {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export type ParagraphStyle = "paragraph" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export type FormatCommand =
  | ParagraphStyle
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "code-block"
  | "link"
  | "quote"
  | "bulleted-list"
  | "numbered-list"
  | "table";

const BLOCK_MARKER = /^(#{1,6}|>|-|\*|\d+\.)(?:\s+(.*))?$/;

interface ParsedLine {
  kind: "heading" | "quote" | "ul" | "ol";
  raw: string;
  body: string;
  level?: number;
}

function parseLine(line: string): ParsedLine | undefined {
  const match = BLOCK_MARKER.exec(line);
  if (!match) return undefined;
  const raw = match[1] ?? "";
  const body = match[2] ?? "";
  if (raw.startsWith("#")) {
    return { kind: "heading", raw, body, level: raw.length };
  }
  if (raw === ">") return { kind: "quote", raw, body };
  if (raw === "-" || raw === "*") return { kind: "ul", raw, body };
  return { kind: "ol", raw, body };
}

interface LineSpan {
  from: number;
  to: number;
  lines: string[];
}

function lineSpan(text: string, start: number, end: number): LineSpan {
  const from = text.lastIndexOf("\n", Math.max(0, start) - 1) + 1;
  let to: number;
  if (end > start && text.charAt(end - 1) === "\n") {
    to = end - 1;
  } else {
    const newline = text.indexOf("\n", end);
    to = newline === -1 ? text.length : newline;
  }
  if (to < from) to = from;
  const slice = text.slice(from, to);
  return { from, to, lines: slice === "" ? [""] : slice.split("\n") };
}

function markerPrefix(line: string): string {
  const parsed = parseLine(line);
  if (!parsed) return "";
  const withSpace = `${parsed.raw} `;
  return line.startsWith(withSpace) ? withSpace : parsed.raw;
}

function caretOnLine(oldLine: string, newLine: string, offset: number): number {
  const oldPrefix = markerPrefix(oldLine).length;
  const newPrefix = markerPrefix(newLine).length;
  if (offset <= oldPrefix) return newPrefix;
  return Math.min(newLine.length, offset + (newPrefix - oldPrefix));
}

function lineAt(lines: string[], offset: number): { index: number; offset: number } {
  let cursor = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (offset <= cursor + line.length || index === lines.length - 1) {
      return { index, offset: Math.min(Math.max(offset - cursor, 0), line.length) };
    }
    cursor += line.length + 1;
  }
  return { index: 0, offset: 0 };
}

function replaceSpan(
  text: string,
  span: LineSpan,
  lines: string[],
  caret: { start: number; end: number } | undefined,
): FormatResult {
  const nextSlice = lines.join("\n");
  if (!caret || caret.start !== caret.end) {
    return {
      text: text.slice(0, span.from) + nextSlice + text.slice(span.to),
      selectionStart: span.from,
      selectionEnd: span.from + nextSlice.length,
    };
  }
  const located = lineAt(span.lines, caret.start - span.from);
  const oldLine = span.lines[located.index] ?? "";
  const newLine = lines[located.index] ?? "";
  let lineStart = span.from;
  for (let index = 0; index < located.index; index += 1) {
    lineStart += (lines[index]?.length ?? 0) + 1;
  }
  const nextCaret = lineStart + caretOnLine(oldLine, newLine, located.offset);
  return {
    text: text.slice(0, span.from) + nextSlice + text.slice(span.to),
    selectionStart: nextCaret,
    selectionEnd: nextCaret,
  };
}

function applyBlock(text: string, start: number, end: number, marker: string): FormatResult {
  const span = lineSpan(text, start, end);
  const matches = (line: string): ParsedLine | undefined => {
    const parsed = parseLine(line);
    if (!parsed) return undefined;
    if (marker === "1.") return parsed.kind === "ol" ? parsed : undefined;
    if (marker === "-") return parsed.kind === "ul" ? parsed : undefined;
    return parsed.raw === marker ? parsed : undefined;
  };
  const remove = span.lines.every((line) => matches(line));
  const lines = span.lines.map((line, index) => {
    const parsed = parseLine(line);
    const body = parsed ? parsed.body : line;
    if (remove) return body;
    const prefix = marker === "1." ? `${index + 1}.` : marker;
    return body ? `${prefix} ${body}` : `${prefix} `;
  });
  return replaceSpan(text, span, lines, { start, end });
}

function applyParagraph(text: string, start: number, end: number): FormatResult {
  const span = lineSpan(text, start, end);
  const lines = span.lines.map((line) => {
    const parsed = parseLine(line);
    return parsed?.kind === "heading" ? parsed.body : line;
  });
  return replaceSpan(text, span, lines, { start, end });
}

function insertInline(
  text: string,
  start: number,
  end: number,
  marker: string,
): FormatResult {
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);
  if (before.endsWith(marker) && after.startsWith(marker)) {
    const next = before.slice(0, -marker.length) + selected + after.slice(marker.length);
    const selectionStart = start - marker.length;
    return {
      text: next,
      selectionStart,
      selectionEnd: selectionStart + selected.length,
    };
  }
  if (
    selected.length >= marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(marker.length, -marker.length);
    return {
      text: before + inner + after,
      selectionStart: start,
      selectionEnd: start + inner.length,
    };
  }
  return {
    text: before + marker + selected + marker + after,
    selectionStart: start + marker.length,
    selectionEnd: end + marker.length,
  };
}

function insertWrap(text: string, start: number, end: number, marker: string): FormatResult {
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);
  const opening = `${marker}\n`;
  const closing = `\n${marker}`;
  if (before.endsWith(opening) && after.startsWith(closing)) {
    const next =
      before.slice(0, -opening.length) + selected + after.slice(closing.length);
    const selectionStart = start - opening.length;
    return {
      text: next,
      selectionStart,
      selectionEnd: selectionStart + selected.length,
    };
  }
  if (selected.startsWith(opening) && selected.endsWith(closing)) {
    const inner = selected.slice(opening.length, -closing.length);
    return {
      text: before + inner + after,
      selectionStart: start,
      selectionEnd: start + inner.length,
    };
  }
  const trimmedBefore = before.replace(/\n{1,2}$/, "");
  const trimmedAfter = after.replace(/^\n{1,2}/, "");
  const gapBefore = trimmedBefore ? "\n\n" : "";
  const gapAfter = trimmedAfter ? "\n\n" : "";
  const body = selected.replace(/\n$/, "");
  const next = `${trimmedBefore}${gapBefore}${marker}\n${body}\n${marker}${gapAfter}${trimmedAfter}`;
  const selectionStart = trimmedBefore.length + gapBefore.length + marker.length + 1;
  return {
    text: next,
    selectionStart,
    selectionEnd: selectionStart + body.length,
  };
}

export function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\/\S+$/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function insertLink(text: string, start: number, end: number): FormatResult {
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);
  if (before.endsWith("[") && after.startsWith("](url)")) {
    const next = before.slice(0, -1) + selected + after.slice("](url)".length);
    const selectionStart = start - 1;
    return {
      text: next,
      selectionStart,
      selectionEnd: selectionStart + selected.length,
    };
  }
  if (!selected || isHttpUrl(selected)) {
    const url = selected || "url";
    return {
      text: `${before}[](${url})${after}`,
      selectionStart: start + 1,
      selectionEnd: start + 1,
    };
  }
  const urlStart = end + 3;
  return {
    text: `${before}[${selected}](url)${after}`,
    selectionStart: urlStart,
    selectionEnd: urlStart + 3,
  };
}

function insertBlockSnippet(
  text: string,
  start: number,
  end: number,
  snippet: string,
  selectFrom: number,
  selectTo: number,
): FormatResult {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const prefix =
    before.length === 0 || before.endsWith("\n\n")
      ? ""
      : before.endsWith("\n")
        ? "\n"
        : "\n\n";
  const suffix =
    after.length === 0 || after.startsWith("\n\n")
      ? ""
      : after.startsWith("\n")
        ? "\n"
        : "\n\n";
  const base = before.length + prefix.length;
  return {
    text: before + prefix + snippet + suffix + after,
    selectionStart: base + selectFrom,
    selectionEnd: base + selectTo,
  };
}

function insertTable(text: string, start: number, end: number): FormatResult {
  const selected = text.slice(start, end);
  const header =
    selected && !selected.includes("\n") && !selected.includes("|") ? selected : "Column 1";
  const snippet = `| ${header} | Column 2 |\n| --- | --- |\n|  |  |`;
  return insertBlockSnippet(text, start, end, snippet, 2, 2 + header.length);
}

function headingMarker(style: ParagraphStyle): string | undefined {
  if (style === "paragraph") return undefined;
  return "#".repeat(Number(style.slice(1)));
}

export function paragraphStyleAt(text: string, cursor: number): ParagraphStyle {
  const line = lineSpan(text, cursor, cursor).lines[0] ?? "";
  const parsed = parseLine(line);
  if (parsed?.kind === "heading" && parsed.level && parsed.level >= 1 && parsed.level <= 6) {
    return `h${parsed.level}` as ParagraphStyle;
  }
  return "paragraph";
}

export function applyFormat(
  text: string,
  start: number,
  end: number,
  command: FormatCommand,
): FormatResult {
  const rangeStart = Math.min(start, end);
  const rangeEnd = Math.max(start, end);
  switch (command) {
    case "bold":
      return insertInline(text, rangeStart, rangeEnd, "**");
    case "italic":
      return insertInline(text, rangeStart, rangeEnd, "_");
    case "strike":
      return insertInline(text, rangeStart, rangeEnd, "~~");
    case "code":
      return text.slice(rangeStart, rangeEnd).includes("\n")
        ? insertWrap(text, rangeStart, rangeEnd, "```")
        : insertInline(text, rangeStart, rangeEnd, "`");
    case "code-block":
      return rangeStart === rangeEnd
        ? insertBlockSnippet(text, rangeStart, rangeEnd, "```\n\n```", 4, 4)
        : insertWrap(text, rangeStart, rangeEnd, "```");
    case "link":
      return insertLink(text, rangeStart, rangeEnd);
    case "quote":
      return applyBlock(text, rangeStart, rangeEnd, ">");
    case "bulleted-list":
      return applyBlock(text, rangeStart, rangeEnd, "-");
    case "numbered-list":
      return applyBlock(text, rangeStart, rangeEnd, "1.");
    case "table":
      return insertTable(text, rangeStart, rangeEnd);
    case "paragraph":
      return applyParagraph(text, rangeStart, rangeEnd);
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const marker = headingMarker(command);
      return marker
        ? applyBlock(text, rangeStart, rangeEnd, marker)
        : applyParagraph(text, rangeStart, rangeEnd);
    }
    default:
      return { text, selectionStart: rangeStart, selectionEnd: rangeEnd };
  }
}

export function insertText(
  text: string,
  start: number,
  end: number,
  insertion: string,
): FormatResult {
  const rangeStart = Math.min(start, end);
  const rangeEnd = Math.max(start, end);
  const next = text.slice(0, rangeStart) + insertion + text.slice(rangeEnd);
  const cursor = rangeStart + insertion.length;
  return { text: next, selectionStart: cursor, selectionEnd: cursor };
}

/** Continue a list on Enter, or leave an empty list item. Returns null to keep the newline. */
export function continueList(
  text: string,
  start: number,
  end: number,
): FormatResult | null {
  if (start !== end) return null;
  const span = lineSpan(text, start, start);
  const line = span.lines[0] ?? "";
  const parsed = parseLine(line);
  if (!parsed || (parsed.kind !== "ul" && parsed.kind !== "ol")) return null;
  const marker = `${parsed.raw} `;
  if (!line.startsWith(marker)) return null;
  const offset = start - span.from;
  if (offset < marker.length) return null;
  const beforeBody = line.slice(marker.length, offset);
  const afterBody = line.slice(offset);
  if (!beforeBody && !afterBody) {
    const removeFrom = span.from > 0 ? span.from - 1 : 0;
    const removeTo = span.from === 0 && text.charAt(span.to) === "\n" ? span.to + 1 : span.to;
    return {
      text: text.slice(0, removeFrom) + text.slice(removeTo),
      selectionStart: removeFrom,
      selectionEnd: removeFrom,
    };
  }
  const nextMarker =
    parsed.kind === "ol" ? `${(Number.parseInt(parsed.raw, 10) || 1) + 1}.` : parsed.raw;
  const current = `${parsed.raw} ${beforeBody}`;
  const nextLine = `${nextMarker} ${afterBody}`;
  const rebuilt = `${current}\n${nextLine}`;
  const cursor = span.from + current.length + 1 + nextMarker.length + 1;
  return {
    text: text.slice(0, span.from) + rebuilt + text.slice(span.to),
    selectionStart: cursor,
    selectionEnd: cursor,
  };
}

/** Turn a pasted http(s) URL over selected text into a Markdown link. */
export function linkifyPaste(
  text: string,
  start: number,
  end: number,
  pasted: string,
): FormatResult | null {
  if (!isHttpUrl(pasted)) return null;
  const rangeStart = Math.min(start, end);
  const rangeEnd = Math.max(start, end);
  const selected = text.slice(rangeStart, rangeEnd);
  if (!selected || isHttpUrl(selected)) return null;
  const before = text.slice(0, rangeStart);
  const after = text.slice(rangeEnd);
  if (before.endsWith("](") || after.startsWith(")")) return null;
  return {
    text: `${before}[${selected}](${pasted})${after}`,
    selectionStart: rangeStart + 1,
    selectionEnd: rangeStart + 1 + selected.length,
  };
}
