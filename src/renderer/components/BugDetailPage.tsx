import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  Component,
  Download,
  File,
  Link,
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
  buildBugUpdate,
  draftFromBug,
  fieldEditorMeta,
  isClosedStatus,
  isOpenStatus,
  parseKeywords,
  validateBugDraft,
  type BugDraft,
} from "../../shared/bug-update";
import {
  detailFieldDefinition,
  formatExtraFieldValue,
  isExtraDetailField,
  readBugFieldValue,
  resolveDetailFields,
} from "../../shared/detail-fields";
import {
  MAX_ATTACHMENT_BYTES,
  type BugAttachmentDraft,
  type BugCommentDraft,
  type BugDetail,
  type BugUpdate,
  type DetailFieldOption,
  type DetailFieldType,
} from "../../shared/types";
import { errorMessage } from "../errors";

interface BugDetailPageProps {
  bug?: BugDetail;
  baseUrl: string;
  loading: boolean;
  error: string;
  detailFields?: string[];
  onBack: () => void;
  onOpenAttachment: (id: number) => Promise<void>;
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
  baseUrl,
  loading,
  error,
  detailFields,
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
  const [fieldCatalog, setFieldCatalog] = useState<DetailFieldOption[]>([]);
  const pendingRef = useRef(false);

  useEffect(() => {
    setEditing(false);
    setDraft(null);
    setFeedback(null);
    setPending(null);
    pendingRef.current = false;
  }, [bug?.id]);

  useEffect(() => {
    const product = bug?.product?.trim();
    if (!product) {
      setFieldCatalog([]);
      return;
    }
    let cancelled = false;
    void window.bugzilli
      .getProductDetailFields(product)
      .then((options) => {
        if (!cancelled) setFieldCatalog(options);
      })
      .catch(() => {
        if (!cancelled) setFieldCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [bug?.product]);

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

  const fieldByKey = new Map(fieldCatalog.map((option) => [option.key, option]));
  const fieldTypes: Record<string, DetailFieldType> = {};
  for (const option of fieldCatalog) {
    if (option.type) fieldTypes[option.key] = option.type;
  }

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
    setDraft(draftFromBug(bug, resolveDetailFields(detailFields)));
    setEditing(true);
    setFeedback(null);
  }

  function updateDraft(values: Partial<BugDraft>) {
    setDraft((current) => {
      if (!current) return current;
      const next = {
        ...current,
        ...values,
        ...(values.extraFields
          ? { extraFields: { ...current.extraFields, ...values.extraFields } }
          : {}),
      };
      if (values.status !== undefined && isOpenStatus(values.status)) {
        next.resolution = "";
      }
      return next;
    });
  }

  async function copyBugzillaLink() {
    if (!bug) return;
    try {
      await window.bugzilli.writeClipboardText(
        `${baseUrl}/show_bug.cgi?id=${bug.id}`,
      );
      setFeedback({ tone: "success", text: "Bugzilla link copied to clipboard." });
    } catch (caught) {
      setFeedback({ tone: "error", text: errorMessage(caught) });
    }
  }

  async function save() {
    if (!bug || !draft || pendingRef.current) return;
    const problem = validateBugDraft(bug, draft, fieldTypes);
    if (problem) {
      setFeedback({ tone: "error", text: problem });
      return;
    }
    const update = buildBugUpdate(bug, draft, fieldTypes);
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
  const dirty = form
    ? Object.keys(buildBugUpdate(bug, form, fieldTypes)).length > 0
    : false;
  const shownStatus = form ? form.status : bug.status;
  const fields = resolveDetailFields(detailFields);
  const fieldKeys = form && !fields.includes("status") ? ["status", ...fields] : fields;

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
            {bug.product} / {form?.component || bug.component} /{" "}
            <span className="bug-id-copy">
              {bug.id}
              <button
                type="button"
                className="bug-id-copy-button"
                aria-label="Copy Bugzilla link"
                title="Copy Bugzilla link"
                onClick={() => void copyBugzillaLink()}
              >
                <Link size={13} aria-hidden="true" />
              </button>
            </span>
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
                    onClick={() => {
                      void (async () => {
                        try {
                          await onOpenAttachment(attachment.id);
                        } catch (caught) {
                          setFeedback({
                            tone: "error",
                            text: errorMessage(caught),
                          });
                        }
                      })();
                    }}
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
          {fieldKeys.map((key) => (
            <DetailField
              key={key}
              fieldKey={key}
              bug={bug}
              form={form}
              fieldOption={fieldByKey.get(key)}
              pending={pending !== null}
              onDraftChange={updateDraft}
            />
          ))}
        </aside>
      </div>
    </main>
  );
}

function fieldIcon(key: string): ReactNode {
  switch (key) {
    case "assignedTo":
    case "creator":
    case "qaContact":
      return <UserRound size={16} />;
    case "creationTime":
    case "lastChangeTime":
    case "deadline":
      return <CalendarDays size={16} />;
    case "component":
      return <Component size={16} />;
    case "platform":
    case "opSys":
      return <Monitor size={16} />;
    case "status":
    case "priority":
    case "severity":
      return <AlertCircle size={16} />;
    default:
      return <Tag size={16} />;
  }
}

function DetailField({
  fieldKey,
  bug,
  form,
  fieldOption,
  pending,
  onDraftChange,
}: {
  fieldKey: string;
  bug: BugDetail;
  form: BugDraft | null;
  fieldOption?: DetailFieldOption | undefined;
  pending: boolean;
  onDraftChange: (values: Partial<BugDraft>) => void;
}) {
  const definition = detailFieldDefinition(fieldKey);
  const icon = fieldIcon(fieldKey);
  const label = fieldOption?.label || definition.label;

  if (form && definition.editable) {
    const editor = fieldEditorMeta(fieldKey, fieldOption);
    const control = (id: string, value: string, onChange: (value: string) => void, disabled = pending) => (
      <ExtraFieldControl
        id={id}
        label={label}
        icon={icon}
        value={value}
        type={editor.type}
        values={editor.values}
        disabled={disabled}
        onChange={onChange}
      />
    );

    switch (definition.editable) {
      case "status":
        return control("bug-status", form.status, (status) => onDraftChange({ status }));
      case "assignedTo":
        return control("bug-assignee", form.assignedTo, (assignedTo) =>
          onDraftChange({ assignedTo }),
        );
      case "priority":
        return control("bug-priority", form.priority, (priority) =>
          onDraftChange({ priority }),
        );
      case "severity":
        return control("bug-severity", form.severity, (severity) =>
          onDraftChange({ severity }),
        );
      case "component":
        return control("bug-component", form.component, (component) =>
          onDraftChange({ component }),
        );
      case "version":
        return control("bug-version", form.version, (version) =>
          onDraftChange({ version }),
        );
      case "platform":
        return control("bug-platform", form.platform, (platform) =>
          onDraftChange({ platform }),
        );
      case "resolution":
        return (
          <>
            {control(
              "bug-resolution",
              form.resolution,
              (resolution) => onDraftChange({ resolution }),
              pending || isOpenStatus(form.status),
            )}
            <p className="field-hint">
              {isClosedStatus(form.status)
                ? "Required while this bug is closed."
                : isOpenStatus(form.status)
                  ? "Cleared automatically while this bug is open."
                  : "Set this when closing the bug."}
            </p>
          </>
        );
      case "keywords": {
        const usesValueList =
          (editor.type === "multiselect" || editor.type === "keywords") &&
          (editor.values?.length ?? 0) > 0;
        return (
          <>
            {control("bug-keywords", form.keywords, (keywords) =>
              onDraftChange({ keywords }),
            )}
            {!usesValueList ? (
              <p className="field-hint">Separate keywords with commas.</p>
            ) : null}
          </>
        );
      }
      default:
        break;
    }
  }

  if (form && isExtraDetailField(fieldKey)) {
    return (
      <ExtraFieldControl
        id={`bug-field-${fieldKey}`}
        label={label}
        icon={icon}
        value={form.extraFields[fieldKey] ?? ""}
        type={fieldOption?.type}
        values={fieldOption?.values}
        disabled={pending}
        onChange={(value) =>
          onDraftChange({ extraFields: { [fieldKey]: value } })
        }
      />
    );
  }

  if (definition.format === "keywords") {
    if (bug.keywords.length === 0) return null;
    return (
      <div className="keyword-list" aria-label={label}>
        {bug.keywords.map((keyword) => (
          <span key={keyword}>{keyword}</span>
        ))}
      </div>
    );
  }

  if (definition.format === "resolution") {
    const resolution = resolutionLabel(bug.resolution);
    if (!resolution && !form) {
      return null;
    }
    return (
      <DetailRow label={label} icon={icon}>
        <strong>{resolution || "—"}</strong>
      </DetailRow>
    );
  }

  if (definition.format === "date") {
    const raw = readBugFieldValue(bug, fieldKey);
    return (
      <DetailRow label={label} icon={icon}>
        <strong>{displayDate(typeof raw === "string" ? raw : "")}</strong>
      </DetailRow>
    );
  }

  if (fieldKey === "assignedTo") {
    return (
      <DetailRow label={label} icon={icon}>
        <strong>{bug.assignedToName || bug.assignedTo || "Unassigned"}</strong>
      </DetailRow>
    );
  }

  if (fieldKey === "creator") {
    return (
      <DetailRow label={label} icon={icon}>
        <strong>{bug.creator || "Unknown"}</strong>
      </DetailRow>
    );
  }

  const raw = readBugFieldValue(bug, fieldKey);
  const display =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.map(String).join(", ")
        : formatExtraFieldValue(raw);

  return (
    <DetailRow label={label} icon={icon}>
      <strong>{display || "—"}</strong>
    </DetailRow>
  );
}

function toDateInputValue(value: string): string {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

function toDateTimeLocalValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  const match = normalized.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2})?/,
  );
  if (!match) return "";
  return `${match[1]}T${match[2]}`;
}

function fromDateTimeLocalValue(value: string): string {
  if (!value) return "";
  return value.length === 16 ? `${value}:00` : value;
}

function ExtraFieldControl({
  id,
  label,
  icon,
  value,
  type,
  values,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  value: string;
  type?: DetailFieldType | undefined;
  values?: string[] | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const options = values ?? [];

  if (type === "select" && options.length > 0) {
    const selectOptions =
      value && !options.includes(value) ? [value, ...options] : options;
    return (
      <div className="detail-row">
        <label className="detail-label" htmlFor={id}>
          {icon} {label}
        </label>
        <select
          id={id}
          className="detail-control"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">—</option>
          {selectOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (
    (type === "multiselect" || type === "keywords") &&
    options.length > 0
  ) {
    const selected = new Set(parseKeywords(value));
    return (
      <div className="detail-row">
        <span className="detail-label" id={`${id}-label`}>
          {icon} {label}
        </span>
        <div
          className="detail-multiselect"
          role="group"
          aria-labelledby={`${id}-label`}
        >
          {options.map((option) => {
            const checked = selected.has(option);
            return (
              <label key={option} className="detail-multiselect-option">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    const next = new Set(selected);
                    if (checked) next.delete(option);
                    else next.add(option);
                    onChange([...next].join(", "));
                  }}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div className="detail-row">
        <label className="detail-label" htmlFor={id}>
          {icon} {label}
        </label>
        <textarea
          id={id}
          className="detail-control detail-control-textarea"
          value={value}
          disabled={disabled}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (type === "date") {
    return (
      <div className="detail-row">
        <label className="detail-label" htmlFor={id}>
          {icon} {label}
        </label>
        <input
          id={id}
          className="detail-control"
          type="date"
          value={toDateInputValue(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (type === "datetime") {
    return (
      <div className="detail-row">
        <label className="detail-label" htmlFor={id}>
          {icon} {label}
        </label>
        <input
          id={id}
          className="detail-control"
          type="datetime-local"
          value={toDateTimeLocalValue(value)}
          disabled={disabled}
          onChange={(event) =>
            onChange(fromDateTimeLocalValue(event.target.value))
          }
        />
      </div>
    );
  }

  if (type === "integer") {
    return (
      <div className="detail-row">
        <label className="detail-label" htmlFor={id}>
          {icon} {label}
        </label>
        <input
          id={id}
          className="detail-control"
          type="number"
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  return (
    <TextControl
      id={id}
      label={label}
      icon={icon}
      value={value}
      suggestions={options.length > 0 ? options : undefined}
      disabled={disabled}
      onChange={onChange}
    />
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
  suggestions?: readonly string[] | undefined;
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
