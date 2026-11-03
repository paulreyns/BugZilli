import {
  Bold,
  Code,
  Italic,
  Link,
  List,
  ListOrdered,
  Smile,
  SquareCode,
  Strikethrough,
  Table,
  TextQuote,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  applyFormat,
  continueList,
  insertText,
  linkifyPaste,
  paragraphStyleAt,
  type FormatCommand,
  type FormatResult,
  type ParagraphStyle,
} from "../../../shared/comment-format";
import { CommentMarkdown } from "./CommentMarkdown";
import { EMOJI_GROUPS, searchEmoji } from "./emoji";

const PARAGRAPH_STYLES: { value: ParagraphStyle; label: string }[] = [
  { value: "paragraph", label: "Paragraph" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "h5", label: "Heading 5" },
  { value: "h6", label: "Heading 6" },
];

function shortcutPrefix(): { mod: string; shift: string } {
  const mac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  return mac ? { mod: "⌘", shift: "⇧" } : { mod: "Ctrl+", shift: "Shift+" };
}

export function CommentEditor({
  id,
  text,
  disabled,
  placeholder,
  baseUrl,
  bugId,
  onTextChange,
}: {
  id: string;
  text: string;
  disabled: boolean;
  placeholder: string;
  baseUrl?: string;
  bugId?: number;
  onTextChange: (text: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPopoverRef = useRef<HTMLDivElement>(null);
  const emojiSearchRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const emittedRef = useRef(text);
  const applyingRef = useRef(false);
  const [style, setStyle] = useState<ParagraphStyle>("paragraph");
  const [preview, setPreview] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");
  const previewId = useId();
  const shortcuts = shortcutPrefix();
  const canPreview = text.trim().length > 0;

  useEffect(() => {
    if (text === emittedRef.current) return;
    const textarea = textareaRef.current;
    if (textarea) textarea.value = text;
    emittedRef.current = text;
  }, [text]);

  useEffect(() => {
    if (!emojiOpen) return;
    emojiSearchRef.current?.focus();
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (emojiPopoverRef.current?.contains(target) || emojiButtonRef.current?.contains(target)) {
        return;
      }
      setEmojiOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setEmojiOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [emojiOpen]);

  function snapshot() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    selectionRef.current = { start, end };
    const next = paragraphStyleAt(textarea.value, start);
    setStyle((current) => (current === next ? current : next));
  }

  function readSelection(): { start: number; end: number } {
    const textarea = textareaRef.current;
    if (textarea && document.activeElement === textarea) {
      return { start: textarea.selectionStart ?? 0, end: textarea.selectionEnd ?? 0 };
    }
    return selectionRef.current;
  }

  function publish(next: string) {
    emittedRef.current = next;
    onTextChange(next);
  }

  function commit(result: FormatResult) {
    const textarea = textareaRef.current;
    if (!textarea) {
      publish(result.text);
      return;
    }
    applyingRef.current = true;
    try {
      textarea.focus();
      const replaced = replaceTextarea(textarea, result.text);
      if (!replaced) textarea.value = result.text;
      const selectionEnd = Math.min(result.selectionEnd, textarea.value.length);
      const selectionStart = Math.min(result.selectionStart, selectionEnd);
      textarea.setSelectionRange(selectionStart, selectionEnd);
      selectionRef.current = { start: selectionStart, end: selectionEnd };
      setStyle(paragraphStyleAt(textarea.value, selectionStart));
      publish(textarea.value);
    } finally {
      applyingRef.current = false;
    }
  }

  function run(command: FormatCommand) {
    if (disabled || preview) return;
    const textarea = textareaRef.current;
    const value = textarea?.value ?? text;
    const selection = readSelection();
    commit(applyFormat(value, selection.start, selection.end, command));
  }

  function insert(snippet: string) {
    if (disabled || preview) return;
    const textarea = textareaRef.current;
    const value = textarea?.value ?? text;
    const selection = readSelection();
    commit(insertText(value, selection.start, selection.end, snippet));
    setEmojiOpen(false);
    setEmojiQuery("");
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    const accel = event.metaKey || event.ctrlKey;
    if (event.key === "Enter" && accel) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
      return;
    }
    if (accel && !event.altKey) {
      const key = event.key.toLowerCase();
      const command = commandForKey(key, event.shiftKey, event.code);
      if (command === "preview") {
        event.preventDefault();
        if (preview || event.currentTarget.value.trim()) setPreview((current) => !current);
        return;
      }
      if (command) {
        event.preventDefault();
        const value = event.currentTarget.value;
        const start = event.currentTarget.selectionStart ?? 0;
        const end = event.currentTarget.selectionEnd ?? start;
        commit(applyFormat(value, start, end, command));
        return;
      }
    }
    if (event.key === "Enter" && !accel && !event.shiftKey && !event.altKey) {
      const value = event.currentTarget.value;
      const start = event.currentTarget.selectionStart ?? 0;
      const end = event.currentTarget.selectionEnd ?? start;
      const next = continueList(value, start, end);
      if (next) {
        event.preventDefault();
        commit(next);
      }
    }
  }

  function onPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData("text");
    const textarea = event.currentTarget;
    const next = linkifyPaste(
      textarea.value,
      textarea.selectionStart ?? 0,
      textarea.selectionEnd ?? 0,
      pasted,
    );
    if (!next) return;
    event.preventDefault();
    commit(next);
  }

  const emojiResults = emojiQuery.trim() ? searchEmoji(emojiQuery) : [];

  return (
    <div className="comment-editor">
      <div className="comment-editor-header">
        <div role="tablist" aria-label="Comment editor">
          <button
            type="button"
            role="tab"
            className="comment-tab"
            aria-selected={!preview}
            tabIndex={preview ? -1 : 0}
            onClick={() => setPreview(false)}
          >
            Edit
          </button>
          <button
            type="button"
            role="tab"
            className="comment-tab"
            aria-selected={preview}
            aria-disabled={!canPreview}
            tabIndex={preview ? 0 : -1}
            title={`Preview (${shortcuts.mod}${shortcuts.shift}P)`}
            onClick={() => {
              if (canPreview) setPreview(true);
            }}
          >
            Preview
          </button>
        </div>
        {!preview && (
          <div role="toolbar" className="comment-toolbar" aria-label="Markdown text-formatting toolbar">
            <div role="group" className="comment-toolbar-group" aria-label="Paragraph style">
              <label className="comment-style">
                <span className="visually-hidden">Paragraph style</span>
                <select
                  aria-label="Paragraph style"
                  value={style}
                  disabled={disabled}
                  onMouseDown={snapshot}
                  onChange={(event) => {
                    const next = event.target.value as ParagraphStyle;
                    setStyle(next);
                    const textarea = textareaRef.current;
                    const value = textarea?.value ?? text;
                    commit(applyFormat(value, selectionRef.current.start, selectionRef.current.end, next));
                  }}
                >
                  {PARAGRAPH_STYLES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div role="group" className="comment-toolbar-group" aria-label="Text style">
              <ToolButton
                label="Bold"
                shortcut={`${shortcuts.mod}B`}
                disabled={disabled}
                onClick={() => run("bold")}
              >
                <Bold size={15} aria-hidden="true" />
              </ToolButton>
              <ToolButton
                label="Italic"
                shortcut={`${shortcuts.mod}I`}
                disabled={disabled}
                onClick={() => run("italic")}
              >
                <Italic size={15} aria-hidden="true" />
              </ToolButton>
              <ToolButton
                label="Strikethrough"
                shortcut={`${shortcuts.mod}${shortcuts.shift}X`}
                disabled={disabled}
                onClick={() => run("strike")}
              >
                <Strikethrough size={15} aria-hidden="true" />
              </ToolButton>
              <ToolButton
                label="Inline code"
                shortcut={`${shortcuts.mod}E`}
                disabled={disabled}
                onClick={() => run("code")}
              >
                <Code size={15} aria-hidden="true" />
              </ToolButton>
            </div>
            <div role="group" className="comment-toolbar-group">
              <ToolButton
                label="Link"
                shortcut={`${shortcuts.mod}K`}
                disabled={disabled}
                onClick={() => run("link")}
              >
                <Link size={15} aria-hidden="true" />
              </ToolButton>
            </div>
            <div role="group" className="comment-toolbar-group" aria-label="Lists">
              <ToolButton
                label="Bulleted list"
                shortcut={`${shortcuts.mod}${shortcuts.shift}8`}
                disabled={disabled}
                onClick={() => run("bulleted-list")}
              >
                <List size={15} aria-hidden="true" />
              </ToolButton>
              <ToolButton
                label="Numbered list"
                shortcut={`${shortcuts.mod}${shortcuts.shift}7`}
                disabled={disabled}
                onClick={() => run("numbered-list")}
              >
                <ListOrdered size={15} aria-hidden="true" />
              </ToolButton>
            </div>
            <div role="group" className="comment-toolbar-group">
              <ToolButton
                label="Quote"
                shortcut={`${shortcuts.mod}${shortcuts.shift}.`}
                disabled={disabled}
                onClick={() => run("quote")}
              >
                <TextQuote size={15} aria-hidden="true" />
              </ToolButton>
            </div>
            <div role="group" className="comment-toolbar-group">
              <ToolButton label="Code block" disabled={disabled} onClick={() => run("code-block")}>
                <SquareCode size={15} aria-hidden="true" />
              </ToolButton>
            </div>
            <div role="group" className="comment-toolbar-group">
              <ToolButton label="Table" disabled={disabled} onClick={() => run("table")}>
                <Table size={15} aria-hidden="true" />
              </ToolButton>
            </div>
            <div role="group" className="comment-toolbar-group emoji-anchor">
              <button
                ref={emojiButtonRef}
                type="button"
                className="comment-tool"
                aria-label="Emoji"
                title="Emoji"
                aria-haspopup="dialog"
                aria-expanded={emojiOpen}
                disabled={disabled}
                onMouseDown={(event) => {
                  event.preventDefault();
                  snapshot();
                }}
                onClick={() => {
                  setEmojiOpen((open) => !open);
                  setEmojiQuery("");
                }}
              >
                <Smile size={15} aria-hidden="true" />
              </button>
              {emojiOpen && (
                <div
                  ref={emojiPopoverRef}
                  className="emoji-popover"
                  role="dialog"
                  aria-label="Emoji"
                >
                  <input
                    ref={emojiSearchRef}
                    className="emoji-search"
                    type="search"
                    aria-label="Search emoji"
                    placeholder="Search emoji"
                    value={emojiQuery}
                    onChange={(event) => setEmojiQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.preventDefault();
                    }}
                  />
                  <div className="emoji-grid">
                    {emojiQuery.trim() ? (
                      emojiResults.length > 0 ? (
                        emojiResults.map((emoji) => (
                          <EmojiButton
                            key={`${emoji.name}-${emoji.char}`}
                            char={emoji.char}
                            name={emoji.name}
                            onPick={insert}
                          />
                        ))
                      ) : (
                        <p className="emoji-empty">No matches</p>
                      )
                    ) : (
                      EMOJI_GROUPS.map((emojiGroup) => (
                        <div className="emoji-section" key={emojiGroup.label}>
                          <p>{emojiGroup.label}</p>
                          <div className="emoji-grid-items">
                            {emojiGroup.emoji.map((emoji) => (
                              <EmojiButton
                                key={`${emojiGroup.label}-${emoji.name}`}
                                char={emoji.char}
                                name={emoji.name}
                                onPick={insert}
                              />
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        className="comment-editor-input"
        defaultValue={text}
        placeholder={placeholder}
        rows={6}
        disabled={disabled}
        hidden={preview}
        onInput={(event) => {
          if (applyingRef.current) return;
          publish(event.currentTarget.value);
          snapshot();
        }}
        onSelect={snapshot}
        onKeyUp={snapshot}
        onMouseUp={snapshot}
        onBlur={snapshot}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
      {preview && (
        <div
          id={previewId}
          className="comment-preview"
          role="tabpanel"
          aria-label="Comment preview"
          tabIndex={0}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "KeyP") {
              event.preventDefault();
              setPreview(false);
            }
          }}
        >
          <CommentMarkdown
            text={text}
            {...(baseUrl ? { baseUrl } : {})}
            {...(bugId !== undefined ? { bugId } : {})}
          />
        </div>
      )}
    </div>
  );
}

function commandForKey(key: string, shift: boolean, code: string): FormatCommand | "preview" | null {
  if (!shift && key === "b") return "bold";
  if (!shift && key === "i") return "italic";
  if (!shift && key === "e") return "code";
  if (!shift && key === "k") return "link";
  if (shift && code === "Period") return "quote";
  if (shift && code === "Digit7") return "numbered-list";
  if (shift && code === "Digit8") return "bulleted-list";
  if (shift && code === "KeyX") return "strike";
  if (shift && code === "KeyP") return "preview";
  return null;
}

function replaceTextarea(textarea: HTMLTextAreaElement, next: string): boolean {
  if (textarea.value === next) return true;
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    if (document.execCommand("insertText", false, next) && textarea.value === next) return true;
  } catch {
    return false;
  }
  return false;
}

function ToolButton({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="comment-tool"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function EmojiButton({
  char,
  name,
  onPick,
}: {
  char: string;
  name: string;
  onPick: (char: string) => void;
}) {
  return (
    <button
      type="button"
      className="emoji-button"
      aria-label={name}
      title={name}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onPick(char)}
    >
      {char}
    </button>
  );
}
