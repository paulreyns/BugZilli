import { Fragment, type ReactNode } from "react";
import { Lexer, type Token, type Tokens } from "marked";

export interface CommentMarkdownProps {
  text: string;
  baseUrl?: string;
  bugId?: number;
}

const MARKDOWN_OFF = /^\s*#\[markdown\(off\)\]\n/;

const SHORTHAND =
  /\battachment\s+#?\s*(\d+)(?:\s+\[diff\])?(?:\s+\[details\])?|\bbugs?\s+#?\s*(\d+)(?:\s*,?\s*comment\s+#?\s*(\d+))?|\bcomment\s+#?\s*(\d+)|\*\*\* This bug has been marked as a duplicate of (\d+) \*\*\*|\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/gi;

function safeHref(href: string): string | undefined {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("//")) return undefined;
  if (trimmed.startsWith("#")) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
        return url.href;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
  return trimmed;
}

function bugHref(baseUrl: string, id: string, comment?: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}/show_bug.cgi?id=${id}`;
  return comment ? `${url}#c${comment}` : url;
}

function hrefForShorthand(
  match: RegExpMatchArray,
  baseUrl: string | undefined,
  bugId: number | undefined,
): string | undefined {
  if (!baseUrl) return undefined;
  const attachment = match[1];
  const bug = match[2];
  const bugComment = match[3];
  const comment = match[4];
  const duplicate = match[5];
  const email = match[6];
  const base = baseUrl.replace(/\/+$/, "");
  if (attachment) return `${base}/attachment.cgi?id=${attachment}`;
  if (bug) return bugHref(baseUrl, bug, bugComment);
  if (comment) return bugId === undefined ? undefined : bugHref(baseUrl, String(bugId), comment);
  if (duplicate) return bugHref(baseUrl, duplicate);
  if (email) return `mailto:${email}`;
  return undefined;
}

function linkify(
  text: string,
  baseUrl: string | undefined,
  bugId: number | undefined,
  key: () => string,
): ReactNode[] {
  if (!baseUrl) return [text];
  const nodes: ReactNode[] = [];
  const pattern = new RegExp(SHORTHAND.source, "gi");
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const href = hrefForShorthand(match, baseUrl, bugId);
    const raw = match[0];
    nodes.push(href ? externalLink(href, raw, key()) : raw);
    last = index + raw.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length > 0 ? nodes : [text];
}

function externalLink(href: string, children: ReactNode, key: string, title?: string): ReactNode {
  return (
    <a
      key={key}
      href={href}
      target="_blank"
      rel="nofollow noreferrer noopener"
      {...(title ? { title } : {})}
    >
      {children}
    </a>
  );
}

function renderPlain(
  text: string,
  baseUrl: string | undefined,
  bugId: number | undefined,
  key: () => string,
): ReactNode {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map((paragraph) => (
    <p key={key()}>
      {paragraph.split("\n").map((line, index) => (
        <Fragment key={key()}>
          {index > 0 ? <br /> : null}
          {linkify(line, baseUrl, bugId, key)}
        </Fragment>
      ))}
    </p>
  ));
}

function renderInline(
  tokens: Token[],
  shorthand: boolean,
  baseUrl: string | undefined,
  bugId: number | undefined,
  key: () => string,
): ReactNode[] {
  return tokens.map((token) => (
    <Fragment key={key()}>{renderToken(token, shorthand, baseUrl, bugId, key)}</Fragment>
  ));
}

function childTokens(token: { tokens?: Token[] }): Token[] {
  return token.tokens ?? [];
}

function renderToken(
  token: Token,
  shorthand: boolean,
  baseUrl: string | undefined,
  bugId: number | undefined,
  key: () => string,
): ReactNode {
  switch (token.type) {
    case "paragraph":
      return <p>{renderInline(childTokens(token), true, baseUrl, bugId, key)}</p>;
    case "heading":
      return renderHeading(token as Tokens.Heading, baseUrl, bugId, key);
    case "blockquote":
      return (
        <blockquote className="comment-blockquote">
          {renderBlocks(childTokens(token), false, baseUrl, bugId, key)}
        </blockquote>
      );
    case "list":
      return renderList(token as Tokens.List, baseUrl, bugId, key);
    case "list_item":
      return <>{renderBlocks(childTokens(token), true, baseUrl, bugId, key)}</>;
    case "code":
      return renderCode(token as Tokens.Code);
    case "codespan":
      return <code>{token.text}</code>;
    case "table":
      return renderTable(token as Tokens.Table, baseUrl, bugId, key);
    case "hr":
      return <hr />;
    case "space":
    case "def":
      return null;
    case "html":
      return token.text;
    case "br":
      return <br />;
    case "strong":
      return <strong>{renderInline(childTokens(token), false, baseUrl, bugId, key)}</strong>;
    case "em":
      return <em>{renderInline(childTokens(token), false, baseUrl, bugId, key)}</em>;
    case "del":
      return <del>{renderInline(childTokens(token), false, baseUrl, bugId, key)}</del>;
    case "link":
      return renderLink(token as Tokens.Link, baseUrl, bugId, key);
    case "image":
      return token.text || token.href || null;
    case "checkbox":
      return token.checked ? "[x] " : "[ ] ";
    case "escape":
      return token.text;
    case "text":
      if (token.tokens && token.tokens.length > 0) {
        return renderInline(token.tokens, shorthand, baseUrl, bugId, key);
      }
      return shorthand ? linkify(token.text, baseUrl, bugId, key) : token.text;
    default:
      return "text" in token && typeof token.text === "string" ? token.text : null;
  }
}

function renderHeading(
  token: Tokens.Heading,
  baseUrl: string | undefined,
  bugId: number | undefined,
  key: () => string,
): ReactNode {
  const depth = Math.min(6, Math.max(1, token.depth));
  const children = renderInline(token.tokens, true, baseUrl, bugId, key);
  switch (depth) {
    case 1:
      return <h1>{children}</h1>;
    case 2:
      return <h2>{children}</h2>;
    case 3:
      return <h3>{children}</h3>;
    case 4:
      return <h4>{children}</h4>;
    case 5:
      return <h5>{children}</h5>;
    default:
      return <h6>{children}</h6>;
  }
}

function renderList(
  token: Tokens.List,
  baseUrl: string | undefined,
  bugId: number | undefined,
  key: () => string,
): ReactNode {
  const items = token.items.map((item) => (
    <li key={key()}>{renderToken(item, false, baseUrl, bugId, key)}</li>
  ));
  if (!token.ordered) return <ul>{items}</ul>;
  return typeof token.start === "number" && token.start > 1 ? (
    <ol start={token.start}>{items}</ol>
  ) : (
    <ol>{items}</ol>
  );
}

function renderCode(token: Tokens.Code): ReactNode {
  const language = token.lang?.trim().split(/\s+/)[0] ?? "";
  const className = /^[A-Za-z0-9_+-]+$/.test(language) ? `language-${language}` : undefined;
  return (
    <pre>
      <code {...(className ? { className } : {})}>{token.text}</code>
    </pre>
  );
}

function renderTable(
  token: Tokens.Table,
  baseUrl: string | undefined,
  bugId: number | undefined,
  key: () => string,
): ReactNode {
  return (
    <div className="comment-table-wrap">
      <table>
        <thead>
          <tr>
            {token.header.map((cell) => (
              <th key={key()} style={cell.align ? { textAlign: cell.align } : undefined} scope="col">
                {renderInline(cell.tokens, true, baseUrl, bugId, key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {token.rows.map((row) => (
            <tr key={key()}>
              {row.map((cell) => (
                <td key={key()} style={cell.align ? { textAlign: cell.align } : undefined}>
                  {renderInline(cell.tokens, true, baseUrl, bugId, key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderLink(
  token: Tokens.Link,
  baseUrl: string | undefined,
  bugId: number | undefined,
  key: () => string,
): ReactNode {
  const children = renderInline(token.tokens, false, baseUrl, bugId, key);
  const href = safeHref(token.href);
  if (!href) return <>{children}</>;
  const title = token.title?.trim();
  return title ? externalLink(href, children, key(), title) : externalLink(href, children, key());
}

function renderBlocks(
  tokens: Token[],
  shorthand: boolean,
  baseUrl: string | undefined,
  bugId: number | undefined,
  key: () => string,
): ReactNode[] {
  return tokens.map((token) => (
    <Fragment key={key()}>{renderToken(token, shorthand, baseUrl, bugId, key)}</Fragment>
  ));
}

export function CommentMarkdown({ text, baseUrl, bugId }: CommentMarkdownProps) {
  const source = text.replace(/\r\n?/g, "\n");
  let nextKey = 0;
  const key = () => `md-${nextKey++}`;
  const body = MARKDOWN_OFF.test(source)
    ? renderPlain(source, baseUrl, bugId, key)
    : renderBlocks(
        new Lexer({ gfm: true, breaks: true }).lex(source),
        false,
        baseUrl,
        bugId,
        key,
      );
  return <div className="markdown-body">{body}</div>;
}
