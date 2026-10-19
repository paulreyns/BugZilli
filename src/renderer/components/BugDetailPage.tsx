import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  Component,
  Download,
  File,
  MessageSquare,
  Monitor,
  Paperclip,
  Pencil,
  Tag,
  Upload,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  PRIORITY_SUGGESTIONS,
  RESOLUTION_SUGGESTIONS,
  SEVERITY_SUGGESTIONS,
  STATUS_SUGGESTIONS,
  buildBugUpdate,
  draftFromBug,
  isClosedStatus,
  isOpenStatus,
  validateBugDraft,
  type BugDraft,
} from "../../shared/bug-update";
import {
  MAX_ATTACHMENT_BYTES,
  type BugAttachmentDraft,
  type BugCommentDraft,
  type BugDetail,
  type BugUpdate,
} from "../../shared/types";
import { errorMessage } from "../errors";

interface BugDetailPageProps {
  bug?: BugDetail;
  loading: boolean;
  error: string;
  onBack: () => void;
  onOpenAttachment: (id: number) => void;
  onUpdateBug: (id: number, update: BugUpdate) => Promise<void>;
  onAddComment: (id: number, comment: BugCommentDraft) => Promise<void>;
  onAddAttachment: (id: number, attachment: BugAttachmentDraft) => Promise<void>;
}

type PendingAction = "save" | "comment" | "attachment";

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

function resolutionLabel(value: string): string {
  return value && value !== "---" ? value : "";
}

export function BugDetailPage({
  bug,
  loading,
  error,
  onBack,
  onOpenAttachment,
  onUpdateBug,
  onAddComment,
  onAddAttachment,
}: BugDetailPageProps) {
  const [tab, setTab] = useState<"comments" | "attachments">("comments");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BugDraft | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    setEditing(false);
    setDraft(null);
    setFeedback(null);
    setPending(null);
    pendingRef.current = false;
  }, [bug?.id]);

  useEffect(() => {
    if (!editing) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (event.target instanceof HTMLTextAreaElement) return;
      setEditing(false);
      setDraft(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  async function run(action: PendingAction, work: () => Promise<string>) {
    if (pendingRef.current) {
      throw new Error("Please wait for the current update to finish.");
    }
    pendingRef.current = true;
    setPending(action);
    setFeedback(null);
    try {
      const message = await work();
      setFeedback({ tone: "success", text: message });
    } catch (caught) {
      setFeedback({ tone: "error", text: errorMessage(caught) });
      throw caught;
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }

  function beginEdit() {
    if (!bug) return;
    setDraft(draftFromBug(bug));
    setEditing(true);
    setFeedback(null);
  }

  function updateDraft(values: Partial<BugDraft>) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...values };
      if (values.status !== undefined && isOpenStatus(values.status)) {
        next.resolution = "";
      }
      return next;
    });
  }

  async function save() {
    if (!bug || !draft || pendingRef.current) return;
    const problem = validateBugDraft(bug, draft);
    if (problem) {
      setFeedback({ tone: "error", text: problem });
      return;
    }
    const update = buildBugUpdate(bug, draft);
    try {
      await run("save", async () => {
        await onUpdateBug(bug.id, update);
        setEditing(false);
        setDraft(null);
        return "Bug updated.";
      });
    } catch {
      // The banner already shows the Bugzilla error.
    }
  }

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

  const form = editing && draft ? draft : null;
  const dirty = form ? Object.keys(buildBugUpdate(bug, form)).length > 0 : false;
  const shownStatus = form ? form.status : bug.status;

  return (
    <main className="page detail-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={16} /> Back to issues
      </button>

      {feedback && (
        <div
          className={feedback.tone === "error" ? "error-banner" : "success-banner"}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.tone === "error" ? <AlertCircle size={17} /> : <Check size={17} />}
          {feedback.text}
        </div>
      )}

      <div className="detail-title">
        <div className="detail-heading">
          <p className="breadcrumbs">
            {bug.product} / {form?.component || bug.component} / BZ-{bug.id}
          </p>
          {form ? (
            <input
              id="bug-summary"
              className="summary-input"
              value={form.summary}
              aria-label="Summary"
              autoFocus
              maxLength={255}
              disabled={pending !== null}
              onChange={(event) => updateDraft({ summary: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void save();
                }
              }}
            />
          ) : (
            <h1>{bug.summary}</h1>
          )}
        </div>
        <div className="detail-actions">
          {form ? (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setEditing(false);
                  setDraft(null);
                }}
                disabled={pending !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void save()}
                disabled={pending !== null || !dirty}
              >
                {pending === "save" ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="secondary-button"
              onClick={beginEdit}
              disabled={pending !== null}
            >
              <Pencil size={15} /> Edit
            </button>
          )}
          <span className="detail-status">
            {(shownStatus || "Status").replaceAll("_", " ")}
          </span>
        </div>
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

            <div
              className="comments"
              role="tabpanel"
              hidden={tab !== "comments"}
            >
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
              <CommentComposer
                key={`comment-${bug.id}`}
                disabled={pending !== null}
                pending={pending === "comment"}
                onSubmit={(comment) =>
                  run("comment", async () => {
                    await onAddComment(bug.id, comment);
                    return "Comment added.";
                  })
                }
              />
            </div>
            <div
              className="attachments"
              role="tabpanel"
              hidden={tab !== "attachments"}
            >
              <AttachmentComposer
                key={`attachment-${bug.id}`}
                disabled={pending !== null}
                pending={pending === "attachment"}
                onSubmit={(attachment) =>
                  run("attachment", async () => {
                    await onAddAttachment(bug.id, attachment);
                    return "Attachment uploaded.";
                  })
                }
              />
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
          </section>
        </div>

        <aside className="detail-sidebar">
          <h2>Details</h2>
          {form && (
            <TextControl
              id="bug-status"
              label="Status"
              icon={<AlertCircle size={16} />}
              value={form.status}
              suggestions={STATUS_SUGGESTIONS}
              disabled={pending !== null}
              onChange={(status) => updateDraft({ status })}
            />
          )}
          {form ? (
            <TextControl
              id="bug-assignee"
              label="Assignee"
              icon={<UserRound size={16} />}
              value={form.assignedTo}
              disabled={pending !== null}
              onChange={(assignedTo) => updateDraft({ assignedTo })}
            />
          ) : (
            <DetailRow label="Assignee" icon={<UserRound size={16} />}>
              <strong>{bug.assignedTo || "Unassigned"}</strong>
            </DetailRow>
          )}
          <DetailRow label="Reporter" icon={<UserRound size={16} />}>
            <strong>{bug.creator || "Unknown"}</strong>
          </DetailRow>
          {form ? (
            <TextControl
              id="bug-priority"
              label="Priority"
              icon={<AlertCircle size={16} />}
              value={form.priority}
              suggestions={PRIORITY_SUGGESTIONS}
              disabled={pending !== null}
              onChange={(priority) => updateDraft({ priority })}
            />
          ) : (
            <DetailRow label="Priority" icon={<AlertCircle size={16} />}>
              <strong>{bug.priority || "—"}</strong>
            </DetailRow>
          )}
          {form ? (
            <TextControl
              id="bug-severity"
              label="Severity"
              icon={<AlertCircle size={16} />}
              value={form.severity}
              suggestions={SEVERITY_SUGGESTIONS}
              disabled={pending !== null}
              onChange={(severity) => updateDraft({ severity })}
            />
          ) : (
            <DetailRow label="Severity" icon={<AlertCircle size={16} />}>
              <strong>{bug.severity || "—"}</strong>
            </DetailRow>
          )}
          {form ? (
            <TextControl
              id="bug-component"
              label="Component"
              icon={<Component size={16} />}
              value={form.component}
              disabled={pending !== null}
              onChange={(component) => updateDraft({ component })}
            />
          ) : (
            <DetailRow label="Component" icon={<Component size={16} />}>
              <strong>{bug.component || "—"}</strong>
            </DetailRow>
          )}
          {form ? (
            <TextControl
              id="bug-version"
              label="Version"
              icon={<Tag size={16} />}
              value={form.version}
              disabled={pending !== null}
              onChange={(version) => updateDraft({ version })}
            />
          ) : (
            <DetailRow label="Version" icon={<Tag size={16} />}>
              <strong>{bug.version || "—"}</strong>
            </DetailRow>
          )}
          {form ? (
            <TextControl
              id="bug-platform"
              label="Platform"
              icon={<Monitor size={16} />}
              value={form.platform}
              disabled={pending !== null}
              onChange={(platform) => updateDraft({ platform })}
            />
          ) : (
            <DetailRow label="Platform" icon={<Monitor size={16} />}>
              <strong>{bug.platform || "—"}</strong>
            </DetailRow>
          )}
          <DetailRow label="Created" icon={<CalendarDays size={16} />}>
            <strong>{displayDate(bug.creationTime)}</strong>
          </DetailRow>
          <DetailRow label="Updated" icon={<CalendarDays size={16} />}>
            <strong>{displayDate(bug.lastChangeTime)}</strong>
          </DetailRow>
          {form ? (
            <>
              <TextControl
                id="bug-resolution"
                label="Resolution"
                icon={<Tag size={16} />}
                value={form.resolution}
                suggestions={RESOLUTION_SUGGESTIONS}
                disabled={pending !== null || isOpenStatus(form.status)}
                onChange={(resolution) => updateDraft({ resolution })}
              />
              <p className="field-hint">
                {isClosedStatus(form.status)
                  ? "Required while this bug is closed."
                  : isOpenStatus(form.status)
                    ? "Cleared automatically while this bug is open."
                    : "Set this when closing the bug."}
              </p>
              <TextControl
                id="bug-keywords"
                label="Keywords"
                icon={<Tag size={16} />}
                value={form.keywords}
                disabled={pending !== null}
                onChange={(keywords) => updateDraft({ keywords })}
              />
              <p className="field-hint">Separate keywords with commas.</p>
            </>
          ) : (
            <>
              {resolutionLabel(bug.resolution) && (
                <DetailRow label="Resolution" icon={<Tag size={16} />}>
                  <strong>{resolutionLabel(bug.resolution)}</strong>
                </DetailRow>
              )}
              {bug.keywords.length > 0 && (
                <div className="keyword-list">
                  {bug.keywords.map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              )}
            </>
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
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="detail-row">
      <span className="detail-label">
        {icon} {label}
      </span>
      {children}
    </div>
  );
}

function TextControl({
  id,
  label,
  icon,
  value,
  suggestions,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  value: string;
  suggestions?: readonly string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="detail-row">
      <label className="detail-label" htmlFor={id}>
        {icon} {label}
      </label>
      <input
        id={id}
        className="detail-control"
        value={value}
        disabled={disabled}
        spellCheck={suggestions === undefined}
        onChange={(event) => onChange(event.target.value)}
        {...(suggestions ? { list: `${id}-options` } : {})}
      />
      {suggestions && (
        <datalist id={`${id}-options`}>
          {suggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </div>
  );
}

function TabEmpty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="tab-empty">
      {icon}
      <span>{text}</span>
    </div>
  );
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

function AttachmentComposer({
  disabled,
  pending,
  onSubmit,
}: {
  disabled: boolean;
  pending: boolean;
  onSubmit: (attachment: BugAttachmentDraft) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState("");
  const [comment, setComment] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [localError, setLocalError] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const previousName = useRef("");

  function chooseFile(next: File | undefined) {
    const selected = next ?? null;
    setFile(selected);
    if (!selected) return;
    setLocalError(
      selected.size > MAX_ATTACHMENT_BYTES
        ? "Attachments must be 10 MB or smaller."
        : "",
    );
    setSummary((current) =>
      !current.trim() || current === previousName.current ? selected.name : current,
    );
    previousName.current = selected.name;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || (file && localError)) return;
    if (!file) {
      setLocalError("Choose a file to upload.");
      return;
    }
    try {
      const data = await readFileAsBase64(file);
      await onSubmit({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        data,
        summary: summary.trim() || file.name,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(isPrivate ? { isPrivate: true } : {}),
      });
      setFile(null);
      setSummary("");
      setComment("");
      setIsPrivate(false);
      setLocalError("");
      previousName.current = "";
      setInputKey((key) => key + 1);
    } catch {
      // The page banner shows the failure.
    }
  }

  return (
    <form className="composer" onSubmit={(event) => void submit(event)}>
      <label className="file-field">
        <Upload size={16} />
        <span>{file ? `${file.name} · ${fileSize(file.size)}` : "Choose a file"}</span>
        <input
          key={inputKey}
          type="file"
          aria-label="Attachment file"
          disabled={disabled}
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
      </label>
      <p className="field-hint">Files up to 10 MB.</p>
      {localError && <p className="composer-error">{localError}</p>}
      <label htmlFor="attachment-summary">Summary</label>
      <input
        id="attachment-summary"
        type="text"
        value={summary}
        placeholder="Short description"
        disabled={disabled}
        onChange={(event) => setSummary(event.target.value)}
      />
      <label htmlFor="attachment-comment">Comment</label>
      <textarea
        id="attachment-comment"
        value={comment}
        placeholder="Optional comment"
        rows={3}
        disabled={disabled}
        onChange={(event) => setComment(event.target.value)}
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
          disabled={disabled || Boolean(file && localError)}
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const marker = "base64,";
      const index = result.indexOf(marker);
      resolve(index >= 0 ? result.slice(index + marker.length) : result);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Could not read the attachment."));
    };
    reader.readAsDataURL(file);
  });
}
