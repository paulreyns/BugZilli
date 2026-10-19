import { Hash, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { parseBugId } from "../../shared/bugId";

interface GoToBugDialogProps {
  onGo: (id: number) => void;
  onClose: () => void;
}

export function GoToBugDialog({ onGo, onClose }: GoToBugDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editedRef = useRef(false);
  const [value, setValue] = useState("");
  const bugId = parseBugId(value);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    inputRef.current?.focus();

    let active = true;
    window.bugzilli
      .readClipboardText()
      .then((text) => {
        const id = parseBugId(text);
        if (!active || editedRef.current || id === undefined) return;
        setValue(String(id));
        requestAnimationFrame(() => inputRef.current?.select());
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="go-to-bug-dialog"
      aria-labelledby="go-to-bug-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (bugId !== undefined) onGo(bugId);
        }}
      >
        <header>
          <h2 id="go-to-bug-title">Go to bug</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <div className="go-to-bug-field">
          <Hash size={16} />
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              editedRef.current = true;
              setValue(event.target.value);
            }}
            placeholder="Bug ID"
            aria-label="Bug ID"
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <footer>
          <span className="go-to-bug-hint">
            {value && bugId === undefined
              ? "Enter a numeric bug ID."
              : "Press Enter to open the bug."}
          </span>
          <button
            type="submit"
            className="primary-button"
            disabled={bugId === undefined}
          >
            Go
          </button>
        </footer>
      </form>
    </dialog>
  );
}
