import { MessageSquare } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import type { BugComment, BugCommentDraft } from "../../../shared/types";
import { formatDetailDate } from "../../utils/date";
import { TabEmpty } from "./TabEmpty";

export function CommentsTab({
  hidden,
  bugId,
  comments,
  disabled,
  pending,
  onSubmit,
}: {
  hidden: boolean;
  bugId: number;
  comments: BugComment[];
  disabled: boolean;
  pending: boolean;
  onSubmit: (comment: BugCommentDraft) => Promise<void>;
}) {
  return (
    <div className="comments" role="tabpanel" hidden={hidden}>
      <CommentList
        comments={comments}
        icon={<MessageSquare size={28} />}
        emptyText="No comments yet."
      />
      <CommentComposer
        key={`comment-${bugId}`}
        disabled={disabled}
        pending={pending}
        onSubmit={onSubmit}
      />
    </div>
  );
}

export function CommentList({
  comments,
  icon,
  emptyText,
}: {
  comments: BugComment[];
  icon: ReactNode;
  emptyText: string;
}) {
  if (comments.length === 0) return <TabEmpty icon={icon} text={emptyText} />;
  return comments.map((comment) => {
    const creator = comment.creatorName || comment.creator;
    return (
      <article className="comment" key={comment.id}>
        <span className="comment-avatar">{creator.slice(0, 1).toUpperCase()}</span>
        <div>
          <header>
            <strong>{creator}</strong>
            <time>{formatDetailDate(comment.creationTime)}</time>
            {comment.isPrivate && <span className="private-pill">Private</span>}
          </header>
          <div className="comment-body">{renderCommentText(comment.text)}</div>
        </div>
      </article>
    );
  });
}

function renderCommentText(text: string): ReactNode {
  const urlPattern = /https?:\/\/[^\s<>"']+/gi;
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(urlPattern)) {
    const fullMatch = match[0];
    const trailingPunctuation = fullMatch.match(/[.,!?;:)\]}]+$/)?.[0] ?? "";
    const url = fullMatch.slice(0, fullMatch.length - trailingPunctuation.length);
    const startIndex = match.index ?? 0;

    if (url.length === 0) continue;

    parts.push(text.slice(lastIndex, startIndex));
    parts.push(
      <a href={url} key={startIndex} rel="noreferrer" target="_blank">
        {url}
      </a>,
    );
    parts.push(trailingPunctuation);
    lastIndex = startIndex + fullMatch.length;
  }

  parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

function CommentComposer({
  disabled,
  pending,
  onSubmit,
}: {
  disabled: boolean;
  pending: boolean;
  onSubmit: (comment: BugCommentDraft) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    try {
      await onSubmit({
        text: trimmed,
        ...(isPrivate ? { isPrivate: true } : {}),
      });
      setText("");
      setIsPrivate(false);
    } catch {
      // The page banner shows the failure.
    }
  }

  return (
    <form className="composer" onSubmit={(event) => void submit(event)}>
      <label htmlFor="bug-comment">Add a comment</label>
      <textarea
        id="bug-comment"
        value={text}
        placeholder="Write a comment…"
        rows={4}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <div className="composer-actions">
        <label className="check-inline">
          <input
            type="checkbox"
            checked={isPrivate}
            disabled={disabled}
            onChange={(event) => setIsPrivate(event.target.checked)}
          />
          Private
        </label>
        <button
          type="submit"
          className="primary-button"
          disabled={disabled || !text.trim()}
        >
          {pending ? "Adding…" : "Add comment"}
        </button>
      </div>
    </form>
  );
}
