import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_DETAIL_FIELDS,
  detailFieldDefinition,
} from "../../shared/detail-fields";
import { summarizeRules } from "../../shared/list-filters";
import type { DetailFieldOption, FilterRule, SavedFilter } from "../../shared/types";
import { errorMessage } from "../errors";

interface AddFilterDialogProps {
  product: string;
  /** When set, the dialog edits this filter instead of creating a new one. */
  initialFilter?: SavedFilter;
  onSave: (filter: SavedFilter) => void;
  onClose: () => void;
}

function defaultFieldOptions(): DetailFieldOption[] {
  const keys = ["status", ...DEFAULT_DETAIL_FIELDS];
  return keys.map((key) => ({
    key,
    label: detailFieldDefinition(key).label,
  }));
}

function emptyRule(): FilterRule {
  return { field: "status", value: "" };
}

export function AddFilterDialog({
  product,
  initialFilter,
  onSave,
  onClose,
}: AddFilterDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editing = Boolean(initialFilter);
  const [name, setName] = useState(initialFilter?.name ?? "");
  const [rules, setRules] = useState<FilterRule[]>(
    initialFilter?.rules.length
      ? initialFilter.rules.map((rule) => ({ ...rule }))
      : [emptyRule()],
  );
  const [fields, setFields] = useState<DetailFieldOption[]>(defaultFieldOptions);
  const [loadingFields, setLoadingFields] = useState(false);
  const [fieldsError, setFieldsError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingFields(true);
    setFieldsError("");
    window.bugzilli
      .getProductDetailFields(product)
      .then((options) => {
        if (!active) return;
        setFields(options.length > 0 ? options : defaultFieldOptions());
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFieldsError(errorMessage(error));
        setFields(defaultFieldOptions());
      })
      .finally(() => {
        if (active) setLoadingFields(false);
      });
    return () => {
      active = false;
    };
  }, [product]);

  const cleanedRules = rules.filter(
    (rule) => rule.field.trim() && rule.value.trim(),
  );
  const canSave = cleanedRules.length > 0;

  function updateRule(index: number, patch: Partial<FilterRule>) {
    setRules((current) =>
      current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    );
  }

  function removeRule(index: number) {
    setRules((current) =>
      current.length <= 1 ? [emptyRule()] : current.filter((_, i) => i !== index),
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    const savedRules = cleanedRules.map((rule) => ({
      field: rule.field.trim(),
      value: rule.value.trim(),
    }));
    onSave({
      id: initialFilter?.id ?? crypto.randomUUID(),
      name: name.trim() || summarizeRules(savedRules),
      rules: savedRules,
    });
  }

  return (
    <dialog
      ref={dialogRef}
      className="add-filter-dialog"
      aria-labelledby="add-filter-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <form onSubmit={submit}>
        <header>
          <h2 id="add-filter-title">
            {editing ? "Edit filter" : "Add filter"}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        <label className="add-filter-name">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={summarizeRules(cleanedRules) || "Optional name"}
            autoComplete="off"
          />
        </label>

        <div className="add-filter-rules">
          <div className="add-filter-rules-header">
            <h3>Match all of</h3>
            {loadingFields && (
              <span className="add-filter-hint">Loading fields…</span>
            )}
          </div>
          {fieldsError && (
            <p className="add-filter-hint">
              Could not load product fields ({fieldsError}). Showing defaults.
            </p>
          )}
          <ul>
            {rules.map((rule, index) => (
              <li key={index}>
                <select
                  value={rule.field}
                  aria-label={`Field ${index + 1}`}
                  onChange={(event) =>
                    updateRule(index, { field: event.target.value })
                  }
                >
                  {fields.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                  {!fields.some((option) => option.key === rule.field) &&
                    rule.field && (
                      <option value={rule.field}>
                        {detailFieldDefinition(rule.field).label}
                      </option>
                    )}
                </select>
                <span className="add-filter-eq" aria-hidden="true">
                  =
                </span>
                <input
                  value={rule.value}
                  onChange={(event) =>
                    updateRule(index, { value: event.target.value })
                  }
                  placeholder="Value"
                  aria-label={`Value ${index + 1}`}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove field ${index + 1}`}
                  onClick={() => removeRule(index)}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="text-button"
            onClick={() => setRules((current) => [...current, emptyRule()])}
          >
            <Plus size={14} />
            Add field
          </button>
        </div>

        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={!canSave}>
            Save filter
          </button>
        </footer>
      </form>
    </dialog>
  );
}
