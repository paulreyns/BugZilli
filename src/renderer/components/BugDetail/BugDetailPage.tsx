import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  Component,
  ExternalLink,
  History,
  Link,
  MessageSquare,
  Minus,
  Monitor,
  Paperclip,
  Pencil,
  Plug,
  Plus,
  Tag,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { isFollowingBug } from "../../../shared/bug-follow";
import {
  buildBugUpdate,
  draftFromBug,
  fieldEditorMeta,
  isClosedStatus,
  isOpenStatus,
  validateBugDraft,
  type BugDraft,
} from "../../../shared/bug-update";
import { bugUrl } from "../../../shared/bugId";
import {
  detailFieldDefinition,
  formatExtraFieldValue,
  isExtraDetailField,
  readBugFieldValue,
  resolveDetailFields,
} from "../../../shared/detail-fields";
import { resolveLinkedColumns } from "../../../shared/linked-columns";
import { splitIntegrationComments } from "../../../shared/integration-comments";
import {
  type Bug,
  type BugAttachmentDraft,
  type BugCommentDraft,
  type BugDetail,
  type BugUpdate,
  type BugzillaUser,
  type DetailFieldOption,
  type DetailFieldType,
  type LinkedBug,
} from "../../../shared/types";
import { errorMessage } from "../../errors";
import { formatDetailDate, formatListDate } from "../../utils/date";
import { FieldControl } from "../field-controls/FieldControl";
import {
  AddLinkedBugDialog,
  type LinkedBugRelation,
} from "./AddLinkedBugDialog";
import { AttachmentsTab } from "./AttachmentsTab";
import { CommentsTab } from "./CommentsTab";
import { FollowMenu } from "./FollowMenu";
import { HistoryTab } from "./HistoryTab";
import { IntegrationsTab } from "./IntegrationsTab";

interface BugDetailPageProps {
  bug?: BugDetail;
  baseUrl: string;
  loading: boolean;
  error: string;
  detailFields?: string[];
  linkedColumns?: string[];
  integrationUser?: string;
  onBack: () => void;
  onOpenBug: (id: number) => void;
  onOpenAttachment: (id: number) => Promise<void>;
  onSaveAttachment: (id: number) => Promise<void>;
  onUpdateBug: (id: number, update: BugUpdate) => Promise<void>;
  onAddComment: (id: number, comment: BugCommentDraft) => Promise<void>;
  onAddAttachment: (id: number, attachment: BugAttachmentDraft) => Promise<void>;
}

type PendingAction = "save" | "comment" | "attachment" | "follow" | "link";

function resolutionLabel(value: string): string {
  return value && value !== "---" ? value : "";
}

export function BugDetailPage({
  bug,
  baseUrl,
  loading,
  error,
  detailFields,
  linkedColumns,
  integrationUser,
  onBack,
  onOpenBug,
  onOpenAttachment,
  onSaveAttachment,
  onUpdateBug,
  onAddComment,
  onAddAttachment,
}: BugDetailPageProps) {
  const [tab, setTab] = useState<
    "comments" | "attachments" | "history" | "integrations"
  >("comments");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BugDraft | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [fieldCatalog, setFieldCatalog] = useState<DetailFieldOption[]>([]);
  const [currentUser, setCurrentUser] = useState<BugzillaUser>();
  const [linking, setLinking] = useState(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    setEditing(false);
    setDraft(null);
    setFeedback(null);
    setPending(null);
    setLinking(false);
    pendingRef.current = false;
  }, [bug?.id]);

  useEffect(() => {
    let cancelled = false;
    void window.bugzilli
      .getCurrentUser()
      .then((user) => {
        if (!cancelled) setCurrentUser(user);
      })
      .catch(() => {
        if (!cancelled) setCurrentUser(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        bugUrl(baseUrl, bug.id),
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

  async function toggleFollowing(follow: boolean) {
    if (!bug || !currentUser?.name.trim() || pendingRef.current || editing) {
      return;
    }
    const alreadyFollowing = isFollowingBug(bug.cc, currentUser);
    if (follow === alreadyFollowing) return;
    const login = currentUser.name.trim();
    try {
      await run("follow", async () => {
        await onUpdateBug(bug.id, {
          cc: follow ? { add: [login] } : { remove: [login] },
        });
        return follow ? "Now following this bug." : "Stopped following this bug.";
      });
    } catch {
      // The banner already shows the Bugzilla error.
    }
  }

  async function saveLinkedBug(relation: LinkedBugRelation, linkedBugId: number) {
    if (!bug || pendingRef.current || editing) return;
    try {
      await run("link", async () => {
        await onUpdateBug(
          bug.id,
          relation === "blocks"
            ? { blocks: { add: [linkedBugId] } }
            : { dependsOn: { add: [linkedBugId] } },
        );
        setLinking(false);
        return relation === "blocks"
          ? `Linked bug ${linkedBugId} as Blocks.`
          : `Linked bug ${linkedBugId} as Depends On.`;
      });
    } catch {
      // The banner already shows the Bugzilla error.
    }
  }

  async function removeLinkedBug(
    relation: LinkedBugRelation,
    linkedBugId: number,
  ) {
    if (!bug || pendingRef.current || editing) return;
    try {
      await run("link", async () => {
        await onUpdateBug(
          bug.id,
          relation === "blocks"
            ? { blocks: { remove: [linkedBugId] } }
            : { dependsOn: { remove: [linkedBugId] } },
        );
        return relation === "blocks"
          ? `Removed bug ${linkedBugId} from Blocks.`
          : `Removed bug ${linkedBugId} from Depends On.`;
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
  const showIntegrations = Boolean(integrationUser?.trim());
  const { comments, integrations: integrationComments } = splitIntegrationComments(
    bug.comments,
    integrationUser,
  );
  const activeTab = tab === "integrations" && !showIntegrations ? "comments" : tab;

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
              <a
                className="bug-id-open-button"
                href={bugUrl(baseUrl, bug.id)}
                target="_blank"
                rel="noreferrer"
                aria-label="Open Bugzilla link in browser"
                title="Open Bugzilla link in browser"
              >
                <ExternalLink size={13} aria-hidden="true" />
              </a>
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
          <FollowMenu
            followers={bug.cc}
            {...(currentUser ? { currentUser } : {})}
            disabled={editing || pending !== null}
            pending={pending === "follow"}
            onStartFollowing={() => void toggleFollowing(true)}
            onStopFollowing={() => void toggleFollowing(false)}
          />
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

          <section className="linked-bugs-section">
            <div className="linked-bugs-header">
              <h2>Linked Bugs</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Add linked bug"
                title="Add linked bug"
                disabled={editing || pending !== null}
                onClick={() => setLinking(true)}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            <LinkedBugTable
              bugs={bug.blocks}
              label="Blocks"
              relation="blocks"
              columns={resolveLinkedColumns(linkedColumns)}
              disabled={editing || pending !== null}
              onOpenBug={onOpenBug}
              onUnlink={removeLinkedBug}
            />
            <LinkedBugTable
              bugs={bug.dependsOn}
              label="Depends On"
              relation="dependsOn"
              columns={resolveLinkedColumns(linkedColumns)}
              disabled={editing || pending !== null}
              onOpenBug={onOpenBug}
              onUnlink={removeLinkedBug}
            />
          </section>

          {linking && (
            <AddLinkedBugDialog
              bugId={bug.id}
              excludeIds={[
                ...bug.blocks.map((linked) => linked.id),
                ...bug.dependsOn.map((linked) => linked.id),
              ]}
              disabled={editing}
              pending={pending === "link"}
              onSave={saveLinkedBug}
              onClose={() => {
                if (pending !== "link") setLinking(false);
              }}
            />
          )}

          <section className="activity-section">
            <div className="tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "comments"}
                className={activeTab === "comments" ? "active" : ""}
                onClick={() => setTab("comments")}
              >
                <MessageSquare size={16} />
                Comments
                <span>{comments.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "attachments"}
                className={activeTab === "attachments" ? "active" : ""}
                onClick={() => setTab("attachments")}
              >
                <Paperclip size={16} />
                Attachments
                <span>{bug.attachments.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "history"}
                className={activeTab === "history" ? "active" : ""}
                onClick={() => setTab("history")}
              >
                <History size={16} />
                History
                <span>{bug.history.length}</span>
              </button>
              {showIntegrations && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "integrations"}
                  className={activeTab === "integrations" ? "active" : ""}
                  onClick={() => setTab("integrations")}
                >
                  <Plug size={16} />
                  Integrations
                  <span>{integrationComments.length}</span>
                </button>
              )}
            </div>

            <CommentsTab
              hidden={activeTab !== "comments"}
              bugId={bug.id}
              comments={comments}
              disabled={pending !== null}
              pending={pending === "comment"}
              onSubmit={(comment) =>
                run("comment", async () => {
                  await onAddComment(bug.id, comment);
                  return "Comment added.";
                })
              }
            />
            <AttachmentsTab
              hidden={activeTab !== "attachments"}
              bugId={bug.id}
              attachments={bug.attachments}
              disabled={pending !== null}
              pending={pending === "attachment"}
              onSubmit={(attachment) =>
                run("attachment", async () => {
                  await onAddAttachment(bug.id, attachment);
                  return "Attachment uploaded.";
                })
              }
              onOpenAttachment={onOpenAttachment}
              onSaveAttachment={onSaveAttachment}
              onError={(text) => setFeedback({ tone: "error", text })}
            />
            <HistoryTab
              hidden={activeTab !== "history"}
              history={bug.history}
            />
            {showIntegrations && (
              <IntegrationsTab
                hidden={activeTab !== "integrations"}
                comments={integrationComments}
              />
            )}
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
      <FieldControl
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
      <FieldControl
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
        <strong>{formatDetailDate(typeof raw === "string" ? raw : "")}</strong>
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

function linkedBugAsBug(linked: LinkedBug): Bug {
  return { ...linked, description: "" };
}

function isLinkedDateColumn(key: string): boolean {
  return (
    detailFieldDefinition(key).format === "date" ||
    key === "creationTime" ||
    key === "lastChangeTime" ||
    key === "deadline"
  );
}

function LinkedBugColumnCell({
  bug,
  column,
}: {
  bug: LinkedBug;
  column: string;
}) {
  switch (column) {
    case "id":
      return <>{bug.id}</>;
    case "summary":
      return <>{bug.summary || "—"}</>;
    case "assignedTo":
      return <>{bug.assignedToName || bug.assignedTo || "Unassigned"}</>;
    default: {
      const raw = readBugFieldValue(linkedBugAsBug(bug), column);
      if (isLinkedDateColumn(column) && typeof raw === "string") {
        return <>{formatListDate(raw)}</>;
      }
      const formatted = formatExtraFieldValue(raw).trim();
      return <>{formatted || "—"}</>;
    }
  }
}

function LinkedBugTable({
  bugs,
  label,
  relation,
  columns,
  disabled = false,
  onOpenBug,
  onUnlink,
}: {
  bugs: LinkedBug[];
  label: string;
  relation: LinkedBugRelation;
  columns?: string[];
  disabled?: boolean;
  onOpenBug: (id: number) => void;
  onUnlink: (relation: LinkedBugRelation, linkedBugId: number) => void;
}) {
  const resolvedColumns = resolveLinkedColumns(columns);
  if (bugs.length === 0) {
    return;
  }
  return (
    <>
      <h3>{label}</h3>
      <div className="linked-bugs-table-wrap">
        <table className="linked-bugs-table" aria-label={label}>
          <thead>
            <tr>
              {resolvedColumns.map((column) => (
                <th key={column} scope="col">
                  {detailFieldDefinition(column).label}
                </th>
              ))}
              <th scope="col" className="linked-bug-unlink-heading">
                <span className="visually-hidden">Remove link</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bugs.map((linked) => (
              <tr
                key={linked.id}
                tabIndex={0}
                onClick={() => onOpenBug(linked.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenBug(linked.id);
                  }
                }}
              >
                {resolvedColumns.map((column) => (
                  <td
                    key={column}
                    className={
                      column === "id"
                        ? "linked-bug-id"
                        : column === "summary"
                          ? "linked-bug-summary"
                          : undefined
                    }
                  >
                    <LinkedBugColumnCell bug={linked} column={column} />
                  </td>
                ))}
                <td className="linked-bug-unlink">
                  <button
                    type="button"
                    className="icon-button linked-bug-unlink-button"
                    aria-label={`Remove link to bug ${linked.id}`}
                    title="Remove link"
                    disabled={disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      onUnlink(relation, linked.id);
                    }}
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
