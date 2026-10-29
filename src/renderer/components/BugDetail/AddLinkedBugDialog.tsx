import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { LinkedBug } from "../../../shared/types";
import { errorMessage } from "../../errors";

export type LinkedBugRelation = "blocks" | "dependsOn";

interface AddLinkedBugDialogProps {
  /** Bug being edited — excluded from search results. */
  bugId: number;
  /** Bug IDs already linked (blocks + depends on). */
  excludeIds: number[];
  disabled?: boolean;
  pending?: boolean;
  onSave: (relation: LinkedBugRelation, linkedBugId: number) => Promise<void>;
  onClose: () => void;
}

const SEARCH_DEBOUNCE_MS = 1000;

function formatResult(bug: LinkedBug): string {
  const summary = bug.summary.trim() || "No summary";
  return `${bug.id} — ${summary}`;
}

export function AddLinkedBugDialog({
  bugId,
  excludeIds,
  disabled = false,
  pending = false,
  onSave,
  onClose,
}: AddLinkedBugDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [relation, setRelation] = useState<LinkedBugRelation>("blocks");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<LinkedBug[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState<LinkedBug | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const excluded = new Set([bugId, ...excludeIds]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (selected) return;
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, selected]);

  useEffect(() => {
    let active = true;
    if (selected || !debouncedQuery) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return;
    }

    setSearching(true);
    setSearchError("");
    void window.bugzilli
      .searchLinkableBugs(debouncedQuery)
      .then((bugs) => {
        if (!active) return;
        const filtered = bugs.filter((bug) => !excluded.has(bug.id));
        setResults(filtered);
        setHighlight(0);
        setMenuOpen(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setResults([]);
        setSearchError(errorMessage(error));
      })
      .finally(() => {
        if (active) setSearching(false);
      });

    return () => {
      active = false;
    };
    // excludeIds / bugId are stable for the life of the dialog
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, bugId, selected]);

  function choose(bug: LinkedBug) {
    setSelected(bug);
    setQuery(formatResult(bug));
    setMenuOpen(false);
  }

  async function save() {
    if (!selected || disabled || pending) return;
    await onSave(relation, selected.id);
  }

  const canSave = Boolean(selected) && !disabled && !pending;
  const showMenu =
    menuOpen &&
    !selected &&
    (searching || results.length > 0 || Boolean(searchError));

  return (
    <dialog
      ref={dialogRef}
      className="add-linked-bug-dialog"
      aria-labelledby="add-linked-bug-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current && !pending) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <header>
          <h2 id="add-linked-bug-title">Add linked bug</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close"
            disabled={pending}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        <label className="add-linked-bug-label" htmlFor="linked-bug-relation">
          Relationship
        </label>
        <select
          id="linked-bug-relation"
          className="add-linked-bug-select"
          value={relation}
          disabled={pending}
          onChange={(event) =>
            setRelation(event.target.value as LinkedBugRelation)
          }
        >
          <option value="blocks">Blocks</option>
          <option value="dependsOn">Depends On</option>
        </select>

        <label className="add-linked-bug-label" htmlFor="linked-bug-search">
          Bug
        </label>
        <div className="add-linked-bug-search">
          <div className="add-linked-bug-search-field">
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              id="linked-bug-search"
              value={query}
              role="combobox"
              aria-expanded={showMenu}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                showMenu && results[highlight]
                  ? `${listId}-option-${results[highlight].id}`
                  : undefined
              }
              placeholder="Search by ID or summary"
              autoComplete="off"
              disabled={pending}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(null);
                setMenuOpen(true);
              }}
              onFocus={() => {
                if (!selected && (results.length > 0 || searching || searchError)) {
                  setMenuOpen(true);
                }
              }}
              onKeyDown={(event) => {
                if (!showMenu || results.length === 0) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setHighlight((current) =>
                    Math.min(current + 1, results.length - 1),
                  );
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setHighlight((current) => Math.max(current - 1, 0));
                } else if (event.key === "Enter" && results[highlight]) {
                  event.preventDefault();
                  choose(results[highlight]);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setMenuOpen(false);
                }
              }}
            />
          </div>
          {showMenu && (
            <ul
              id={listId}
              className="add-linked-bug-results"
              role="listbox"
              aria-label="Matching bugs"
            >
              {searching ? (
                <li className="add-linked-bug-results-status" role="presentation">
                  Searching…
                </li>
              ) : searchError ? (
                <li className="add-linked-bug-results-status" role="presentation">
                  {searchError}
                </li>
              ) : results.length === 0 ? (
                <li className="add-linked-bug-results-status" role="presentation">
                  No matching bugs.
                </li>
              ) : (
                results.map((bug, index) => (
                  <li key={bug.id} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-option-${bug.id}`}
                      role="option"
                      aria-selected={index === highlight}
                      className={
                        index === highlight
                          ? "add-linked-bug-result active"
                          : "add-linked-bug-result"
                      }
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => choose(bug)}
                    >
                      <span className="add-linked-bug-result-id">{bug.id}</span>
                      <span className="add-linked-bug-result-summary">
                        {bug.summary.trim() || "No summary"}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <footer>
          <button
            type="button"
            className="secondary-button"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={!canSave}>
            {pending ? "Saving…" : "Save"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
