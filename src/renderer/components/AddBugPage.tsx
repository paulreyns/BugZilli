import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Component,
  Monitor,
  Tag,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  addBugFieldKeys,
  bugCreateErrorSummary,
  emptyBugCreate,
  fieldsForCreateError,
  firstCreateIssueKey,
  isCreateFieldRequired,
  isCreateReadonlyField,
  readCreateField,
  validateBugCreate,
  writeCreateField,
} from "../../shared/bug-create";
import {
  fieldEditorMeta,
  isClosedStatus,
  isOpenStatus,
} from "../../shared/bug-update";
import {
  detailFieldDefinition,
  isExtraDetailField,
} from "../../shared/detail-fields";
import type {
  BugCreate,
  BugDetail,
  BugzillaUser,
  DetailFieldOption,
  DetailFieldType,
} from "../../shared/types";
import { errorMessage } from "../errors";
import { FieldControl } from "./field-controls/FieldControl";
import { RequiredMark } from "./field-controls/FieldShell";

interface AddBugPageProps {
  product: string;
  detailFields?: string[] | undefined;
  onBack: () => void;
  onCreated: (bug: BugDetail) => void;
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

function fieldControlId(key: string): string {
  switch (key) {
    case "summary":
      return "bug-summary";
    case "description":
      return "bug-description";
    case "status":
      return "bug-status";
    case "assignedTo":
      return "bug-assignee";
    case "priority":
      return "bug-priority";
    case "severity":
      return "bug-severity";
    case "component":
      return "bug-component";
    case "version":
      return "bug-version";
    case "platform":
      return "bug-platform";
    case "resolution":
      return "bug-resolution";
    case "keywords":
      return "bug-keywords";
    default:
      return `bug-field-${key}`;
  }
}

function readonlyValue(key: string, user: BugzillaUser | undefined): string {
  if (key === "creator") return user?.realName || user?.name || "—";
  return "—";
}

export function AddBugPage({
  product,
  detailFields,
  onBack,
  onCreated,
}: AddBugPageProps) {
  const fieldKeys = addBugFieldKeys(detailFields);
  const [draft, setDraft] = useState<BugCreate>(() => emptyBugCreate(fieldKeys));
  const [fieldCatalog, setFieldCatalog] = useState<DetailFieldOption[]>([]);
  const [currentUser, setCurrentUser] = useState<BugzillaUser>();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const fieldErrorsRef = useRef(fieldErrors);
  const pendingRef = useRef(false);
  const focusKeyRef = useRef<string | null>(null);

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
    const trimmed = product.trim();
    if (!trimmed) {
      setFieldCatalog([]);
      return;
    }
    let cancelled = false;
    void window.bugzilli
      .getProductDetailFields(trimmed)
      .then((options) => {
        if (!cancelled) setFieldCatalog(options);
      })
      .catch(() => {
        if (!cancelled) setFieldCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [product]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || pendingRef.current) return;
      if (event.target instanceof HTMLTextAreaElement) return;
      onBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  useEffect(() => {
    const key = focusKeyRef.current;
    if (!key) return;
    focusKeyRef.current = null;
    document.getElementById(fieldControlId(key))?.focus();
  }, [fieldErrors]);

  const fieldByKey = new Map(fieldCatalog.map((option) => [option.key, option]));
  const fieldTypes: Record<string, DetailFieldType> = {};
  for (const option of fieldCatalog) {
    if (option.type) fieldTypes[option.key] = option.type;
  }

  function updateField(key: string, value: string) {
    setDraft((current) => writeCreateField(current, key, value));
    const currentErrors = fieldErrorsRef.current;
    if (!currentErrors[key] && !(key === "status" && currentErrors.resolution)) return;
    const next = { ...currentErrors };
    delete next[key];
    if (key === "status") delete next.resolution;
    fieldErrorsRef.current = next;
    setFieldErrors(next);
    setFeedback(Object.keys(next).length > 0 ? bugCreateErrorSummary(next) : "");
  }

  function showIssues(issues: Record<string, string>) {
    fieldErrorsRef.current = issues;
    setFieldErrors(issues);
    setFeedback(bugCreateErrorSummary(issues));
    focusKeyRef.current = firstCreateIssueKey(issues, fieldKeys) ?? null;
  }

  async function save() {
    if (pendingRef.current) return;
    const issues = validateBugCreate(draft, fieldKeys, fieldByKey);
    if (Object.keys(issues).length > 0) {
      showIssues(issues);
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setFeedback("");
    fieldErrorsRef.current = {};
    setFieldErrors({});
    try {
      const bug = await window.bugzilli.createBug(product, draft, fieldTypes);
      onCreated(bug);
    } catch (caught) {
      const message = errorMessage(caught);
      const keys = fieldsForCreateError(message, fieldKeys, fieldCatalog);
      if (keys.length > 0) {
        const next: Record<string, string> = {};
        for (const key of keys) next[key] = message;
        fieldErrorsRef.current = next;
        setFieldErrors(next);
        focusKeyRef.current = keys[0] ?? null;
      }
      setFeedback(message);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  const summaryError = fieldErrors.summary;
  const descriptionError = fieldErrors.description;
  const descriptionRequired = isCreateFieldRequired(
    "description",
    fieldByKey.get("description"),
    draft.status,
  );

  return (
    <main className="page detail-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={16} /> Back to issues
      </button>

      {feedback && (
        <div className="error-banner" role="alert">
          <AlertCircle size={17} />
          {feedback}
        </div>
      )}

      <div className="detail-title">
        <div className="detail-heading">
          <p className="breadcrumbs">{product} / New bug</p>
          <div className="summary-edit">
            <input
              id="bug-summary"
              className={
                summaryError ? "summary-input summary-input-invalid" : "summary-input"
              }
              value={draft.summary}
              aria-label="Summary"
              aria-required="true"
              aria-invalid={summaryError ? true : undefined}
              aria-describedby={summaryError ? "bug-summary-error" : undefined}
              autoFocus
              maxLength={255}
              disabled={pending}
              onChange={(event) => updateField("summary", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void save();
                }
              }}
            />
            <RequiredMark />
            {summaryError ? (
              <AlertCircle
                className="field-error-icon summary-error-icon"
                size={18}
                aria-hidden="true"
              />
            ) : null}
          </div>
          {summaryError ? (
            <p className="field-error" id="bug-summary-error" role="alert">
              {summaryError}
            </p>
          ) : null}
        </div>
        <div className="detail-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onBack}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void save()}
            disabled={pending}
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {draft.status.trim() ? (
            <span className="detail-status">
              {draft.status.trim().replaceAll("_", " ")}
            </span>
          ) : null}
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="description-section">
            <h2 className="section-heading">
              Description
              {descriptionRequired ? <RequiredMark /> : null}
              {descriptionError ? (
                <AlertCircle className="field-error-icon" size={14} aria-hidden="true" />
              ) : null}
            </h2>
            <textarea
              id="bug-description"
              className={
                descriptionError
                  ? "description-input description-input-invalid"
                  : "description-input"
              }
              value={draft.description}
              aria-label="Description"
              aria-required={descriptionRequired || undefined}
              aria-invalid={descriptionError ? true : undefined}
              aria-describedby={descriptionError ? "bug-description-error" : undefined}
              disabled={pending}
              rows={6}
              placeholder="Describe the problem"
              onChange={(event) => updateField("description", event.target.value)}
            />
            {descriptionError ? (
              <p className="field-error" id="bug-description-error" role="alert">
                {descriptionError}
              </p>
            ) : null}
          </section>
        </div>

        <aside className="detail-sidebar">
          <h2>Details</h2>
          {fieldKeys.map((key) => (
            <CreateField
              key={key}
              fieldKey={key}
              draft={draft}
              fieldOption={fieldByKey.get(key)}
              error={fieldErrors[key]}
              pending={pending}
              currentUser={currentUser}
              onChange={updateField}
            />
          ))}
        </aside>
      </div>
    </main>
  );
}

function CreateField({
  fieldKey,
  draft,
  fieldOption,
  error,
  pending,
  currentUser,
  onChange,
}: {
  fieldKey: string;
  draft: BugCreate;
  fieldOption?: DetailFieldOption | undefined;
  error?: string | undefined;
  pending: boolean;
  currentUser: BugzillaUser | undefined;
  onChange: (key: string, value: string) => void;
}) {
  const definition = detailFieldDefinition(fieldKey);
  const icon = fieldIcon(fieldKey);
  const label = fieldOption?.label || definition.label;
  const invalid = Boolean(error);

  if (isCreateReadonlyField(fieldKey) || (!definition.editable && !isExtraDetailField(fieldKey) && fieldKey !== "status")) {
    return (
      <div className="detail-row">
        <span className="detail-label">
          {icon} {label}
        </span>
        <strong>{readonlyValue(fieldKey, currentUser)}</strong>
      </div>
    );
  }

  const required = isCreateFieldRequired(fieldKey, fieldOption, draft.status);
  const editor = fieldEditorMeta(fieldKey, fieldOption);
  const usesKeywordList =
    fieldKey === "keywords" &&
    (editor.type === "multiselect" || editor.type === "keywords") &&
    (editor.values?.length ?? 0) > 0;

  return (
    <>
      <FieldControl
        id={fieldControlId(fieldKey)}
        label={label}
        icon={icon}
        value={readCreateField(draft, fieldKey)}
        type={editor.type}
        values={editor.values}
        disabled={pending || (fieldKey === "resolution" && isOpenStatus(draft.status))}
        required={required}
        invalid={invalid}
        {...(error ? { error } : {})}
        onChange={(value) => onChange(fieldKey, value)}
      />
      {fieldKey === "resolution" ? (
        <p className="field-hint">
          {isClosedStatus(draft.status)
            ? "Required while this bug is closed."
            : isOpenStatus(draft.status)
              ? "Cleared automatically while this bug is open."
              : "Set this when closing the bug."}
        </p>
      ) : null}
      {fieldKey === "keywords" && !usesKeywordList ? (
        <p className="field-hint">Separate keywords with commas.</p>
      ) : null}
    </>
  );
}
