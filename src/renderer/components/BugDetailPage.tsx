import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Download,
  File,
  MessageSquare,
  Paperclip,
  Tag,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import type { BugDetail } from "../../shared/types";

interface BugDetailPageProps {
  bug?: BugDetail;
  loading: boolean;
  error: string;
  onBack: () => void;
  onOpenAttachment: (id: number) => void;
}

function displayDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function BugDetailPage({
  bug,
  loading,
  error,
  onBack,
  onOpenAttachment,
}: BugDetailPageProps) {
  const [tab, setTab] = useState<"comments" | "attachments">("comments");

  if (loading) {
    return (
      <main className="page detail-page">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> Back to issues
        </button>
        <div className="detail-skeleton">
          <span />
          <span />
          <span />
          <span />
        </div>
      </main>
    );
  }

  if (error || !bug) {
    return (
      <main className="page detail-page">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> Back to issues
        </button>
        <div className="empty-state">
          <AlertCircle size={36} />
          <h2>Could not load this bug</h2>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page detail-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={16} /> Back to issues
      </button>

      <div className="detail-title">
        <div>
          <p className="breadcrumbs">
            {bug.product} / {bug.component} / BZ-{bug.id}
          </p>
          <h1>{bug.summary}</h1>
        </div>
        <span className="detail-status">
          {bug.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="description-section">
            <h2>Description</h2>
            <div className="description-content">
              {bug.description || "No description was provided."}
            </div>
          </section>

          <section className="activity-section">
            <div className="tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "comments"}
                className={tab === "comments" ? "active" : ""}
                onClick={() => setTab("comments")}
              >
                <MessageSquare size={16} />
                Comments
                <span>{bug.comments.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "attachments"}
                className={tab === "attachments" ? "active" : ""}
                onClick={() => setTab("attachments")}
              >
                <Paperclip size={16} />
                Attachments
                <span>{bug.attachments.length}</span>
              </button>
            </div>

            {tab === "comments" ? (
              <div className="comments">
                {bug.comments.length === 0 ? (
                  <TabEmpty icon={<MessageSquare size={28} />} text="No comments yet." />
                ) : (
                  bug.comments.map((comment) => (
                    <article className="comment" key={comment.id}>
                      <span className="comment-avatar">
                        {comment.creator.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <header>
                          <strong>{comment.creator}</strong>
                          <time>{displayDate(comment.creationTime)}</time>
                          {comment.isPrivate && (
                            <span className="private-pill">Private</span>
                          )}
                        </header>
                        <div className="comment-body">{comment.text}</div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            ) : (
              <div className="attachments">
                {bug.attachments.length === 0 ? (
                  <TabEmpty icon={<Paperclip size={28} />} text="No attachments." />
                ) : (
                  bug.attachments.map((attachment) => (
                    <button
                      type="button"
                      className="attachment"
                      key={attachment.id}
                      onClick={() => onOpenAttachment(attachment.id)}
                    >
                      <span className="file-icon">
                        <File size={20} />
                      </span>
                      <span className="attachment-info">
                        <strong>{attachment.fileName}</strong>
                        <span>
                          {attachment.summary || attachment.contentType} ·{" "}
                          {fileSize(attachment.size)}
                        </span>
                      </span>
                      {attachment.isObsolete && (
                        <span className="obsolete-pill">Obsolete</span>
                      )}
                      <Download size={17} />
                    </button>
                  ))
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="detail-sidebar">
          <h2>Details</h2>
          <DetailRow label="Assignee" icon={<UserRound size={16} />}>
            {bug.assignedTo || "Unassigned"}
          </DetailRow>
          <DetailRow label="Reporter" icon={<UserRound size={16} />}>
            {bug.creator || "Unknown"}
          </DetailRow>
          <DetailRow label="Priority" icon={<AlertCircle size={16} />}>
            {bug.priority || "—"}
          </DetailRow>
          <DetailRow label="Severity" icon={<AlertCircle size={16} />}>
            {bug.severity || "—"}
          </DetailRow>
          <DetailRow label="Version" icon={<Tag size={16} />}>
            {bug.version || "—"}
          </DetailRow>
          <DetailRow label="Created" icon={<CalendarDays size={16} />}>
            {displayDate(bug.creationTime)}
          </DetailRow>
          <DetailRow label="Updated" icon={<CalendarDays size={16} />}>
            {displayDate(bug.lastChangeTime)}
          </DetailRow>
          {bug.resolution && (
            <DetailRow label="Resolution" icon={<Tag size={16} />}>
              {bug.resolution}
            </DetailRow>
          )}
          {bug.keywords.length > 0 && (
            <div className="keyword-list">
              {bug.keywords.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function DetailRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="detail-row">
      <span className="detail-label">
        {icon} {label}
      </span>
      <strong>{children}</strong>
    </div>
  );
}

function TabEmpty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="tab-empty">
      {icon}
      <span>{text}</span>
    </div>
  );
}
