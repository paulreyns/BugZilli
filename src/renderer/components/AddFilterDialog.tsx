import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_DETAIL_FIELDS,
  detailFieldDefinition,
} from "../../shared/detail-fields";
import {
  DEFAULT_FILTER_OPERATOR,
  FILTER_OPERATORS,
  normalizeFilterOperator,
  operatorNeedsValue,
  summarizeRules,
} from "../../shared/list-filters";
import type {
  DetailFieldOption,
  FilterOperator,
  FilterRule,
  SavedFilter,
} from "../../shared/types";
import { errorMessage } from "../errors";

interface AddFilterDialogProps {
  product: string;
  /** When set, the dialog edits this filter instead of creating a new one. */
  initialFilter?: SavedFilter;
  onSave: (filter: SavedFilter) => void;
  onClose: () => void;
}

function defaultFieldOptions(): DetailFieldOption[] {
  const keys = ["status", "summary", ...DEFAULT_DETAIL_FIELDS];
  return keys.map((key) => ({
    key,
    label: detailFieldDefinition(key).label,
  }));
}

function includeSummaryField(options: DetailFieldOption[]): DetailFieldOption[] {
  return options.some(({ key }) => key === "summary")
    ? options
    : [...options, { key: "summary", label: "Summary" }];
}

function emptyRule(): FilterRule {
  return { field: "status", operator: DEFAULT_FILTER_OPERATOR, value: "" };
}

function ruleIsComplete(rule: FilterRule): boolean {
  if (!rule.field.trim()) return false;
  const operator = normalizeFilterOperator(rule.operator);
  return !operatorNeedsValue(operator) || Boolean(rule.value.trim());
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
      ? initialFilter.rules.map((rule) => ({
          field: rule.field,
          operator: normalizeFilterOperator(rule.operator),
          value: rule.value,
        }))
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
        setFields(
          options.length > 0
            ? includeSummaryField(options)
            : defaultFieldOptions(),
        );
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

  const cleanedRules = rules.filter(ruleIsComplete);
  const canSave = cleanedRules.length > 0;

  function updateRule(index: number, patch: Partial<FilterRule>) {
    setRules((current) =>
      current.map((rule, i) => {
        if (i !== index) return rule;
        const next = { ...rule, ...patch };
        if (
          patch.operator &&
          !operatorNeedsValue(normalizeFilterOperator(patch.operator))
        ) {
          next.value = "";
        }
        return next;
      }),
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
    const savedRules = cleanedRules.map((rule) => {
      const operator = normalizeFilterOperator(rule.operator);
      return {
        field: rule.field.trim(),
        operator,
        value: operatorNeedsValue(operator) ? rule.value.trim() : "",
      };
    });
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
            {rules.map((rule, index) => {
              const operator = normalizeFilterOperator(rule.operator);
              const needsValue = operatorNeedsValue(operator);
              return (
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
                  <select
                    value={operator}
                    aria-label={`Operator ${index + 1}`}
                    onChange={(event) =>
                      updateRule(index, {
                        operator: event.target.value as FilterOperator,
                      })
                    }
                  >
                    {FILTER_OPERATORS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={rule.value}
                    onChange={(event) =>
                      updateRule(index, { value: event.target.value })
                    }
                    placeholder={needsValue ? "Value" : "No value needed"}
                    aria-label={`Value ${index + 1}`}
                    autoComplete="off"
                    disabled={!needsValue}
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
              );
            })}
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
