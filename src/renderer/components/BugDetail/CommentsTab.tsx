import { MessageSquare } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import type { BugComment, BugCommentDraft } from "../../../shared/types";
import { formatDetailDate } from "../../utils/date";
import { initials, userAvatarStyle } from "../BugViewShared";
import { CommentEditor } from "./CommentEditor";
import { CommentMarkdown } from "./CommentMarkdown";
import { TabEmpty } from "./TabEmpty";

export function CommentsTab({
  hidden,
  bugId,
  comments,
  disabled,
  pending,
  baseUrl,
  onSubmit,
}: {
  hidden: boolean;
  bugId: number;
  comments: BugComment[];
  disabled: boolean;
  pending: boolean;
  baseUrl?: string;
  onSubmit: (comment: BugCommentDraft) => Promise<void>;
}) {
  return (
    <div className="comments" role="tabpanel" hidden={hidden}>
      <CommentList
        comments={comments}
        icon={<MessageSquare size={28} />}
        emptyText="No comments yet."
        bugId={bugId}
        {...(baseUrl ? { baseUrl } : {})}
      />
      <CommentComposer
        key={`comment-${bugId}`}
        bugId={bugId}
        disabled={disabled}
        pending={pending}
        {...(baseUrl ? { baseUrl } : {})}
        onSubmit={onSubmit}
      />
    </div>
  );
}

export function CommentList({
  comments,
  icon,
  emptyText,
  baseUrl,
  bugId,
}: {
  comments: BugComment[];
  icon: ReactNode;
  emptyText: string;
  baseUrl?: string;
  bugId?: number;
}) {
  if (comments.length === 0) return <TabEmpty icon={icon} text={emptyText} />;
  return comments.map((comment) => {
    const creator = comment.creatorName || comment.creator;
    return (
      <article className="comment" key={comment.id}>
        <span
          className="comment-avatar"
          title={creator}
          style={userAvatarStyle(comment.creator || creator)}
        >
          {initials(creator) || "?"}
        </span>
        <div>
          <header>
            <strong>{creator}</strong>
            <time>{formatDetailDate(comment.creationTime)}</time>
            {comment.isPrivate && <span className="private-pill">Private</span>}
          </header>
          <div className="comment-body">
            <CommentMarkdown
              text={comment.text}
              {...(baseUrl ? { baseUrl } : {})}
              {...(bugId !== undefined ? { bugId } : {})}
            />
          </div>
        </div>
      </article>
    );
  });
}

function CommentComposer({
  bugId,
  disabled,
  pending,
  baseUrl,
  onSubmit,
}: {
  bugId: number;
  disabled: boolean;
  pending: boolean;
  baseUrl?: string;
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
      <CommentEditor
        id="bug-comment"
        text={text}
        disabled={disabled}
        placeholder="Write a comment…"
        bugId={bugId}
        {...(baseUrl ? { baseUrl } : {})}
        onTextChange={setText}
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
