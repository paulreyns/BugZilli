import { Download, File, Paperclip, Upload } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import {
  MAX_ATTACHMENT_BYTES,
  type BugAttachment,
  type BugAttachmentDraft,
} from "../../../shared/types";
import { errorMessage } from "../../errors";
import { formatDetailDate } from "../../utils/date";
import { TabEmpty } from "./TabEmpty";

export function AttachmentsTab({
  hidden,
  bugId,
  attachments,
  disabled,
  pending,
  onSubmit,
  onOpenAttachment,
  onSaveAttachment,
  onError,
}: {
  hidden: boolean;
  bugId: number;
  attachments: BugAttachment[];
  disabled: boolean;
  pending: boolean;
  onSubmit: (attachment: BugAttachmentDraft) => Promise<void>;
  onOpenAttachment: (id: number) => Promise<void>;
  onSaveAttachment: (id: number) => Promise<void>;
  onError: (message: string) => void;
}) {
  const sortedAttachments = [...attachments].sort(
    (left, right) =>
      Date.parse(right.creationTime) - Date.parse(left.creationTime),
  );

  return (
    <div className="attachments" role="tabpanel" hidden={hidden}>
      <AttachmentComposer
        key={`attachment-${bugId}`}
        disabled={disabled}
        pending={pending}
        onSubmit={onSubmit}
      />
      {attachments.length === 0 ? (
        <TabEmpty icon={<Paperclip size={28} />} text="No attachments." />
      ) : (
        sortedAttachments.map((attachment) => (
          <div className="attachment" key={attachment.id}>
            <button
              type="button"
              className="attachment-open"
              title={`Open ${attachment.fileName}`}
              onClick={() => runAction(onOpenAttachment, attachment.id)}
            >
              <span className="file-icon">
                <File size={20} />
              </span>
              <span className="attachment-info">
                <span className="attachment-title">
                  <strong>{attachment.fileName}</strong>
                  <span>({fileSize(attachment.size)})</span>
                </span>
                <span className="attachment-meta">
                  {attachment.summary || attachment.contentType} ·{" "}
                  {formatDetailDate(attachment.creationTime)} ·{" "}
                  {attachment.creatorName || attachment.creator}
                </span>
              </span>
              {attachment.isObsolete && (
                <span className="obsolete-pill">Obsolete</span>
              )}
            </button>
            <button
              type="button"
              className="attachment-download"
              title={`Save ${attachment.fileName} as…`}
              aria-label={`Save ${attachment.fileName} as`}
              onClick={() => runAction(onSaveAttachment, attachment.id)}
            >
              <Download size={17} />
            </button>
          </div>
        ))
      )}
    </div>
  );

  function runAction(action: (id: number) => Promise<void>, id: number) {
    void (async () => {
      try {
        await action(id);
      } catch (caught) {
        onError(errorMessage(caught));
      }
    })();
  }
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
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
