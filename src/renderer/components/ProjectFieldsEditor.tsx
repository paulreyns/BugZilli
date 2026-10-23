import { ArrowDown, ArrowUp, RotateCcw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { DetailFieldOption } from "../../shared/types";
import { errorMessage } from "../errors";

export interface ProjectFieldsEditorProps {
  title: string;
  description: string;
  product: string;
  fields: string[] | undefined;
  onChange: (fields: string[]) => void;
  resolveFields: (fields: string[] | undefined) => string[];
  defaultFields: () => string[];
  fieldLabel: (key: string) => string;
}

export function ProjectFieldsEditor({
  title,
  description,
  product,
  fields,
  onChange,
  resolveFields,
  defaultFields,
  fieldLabel,
}: ProjectFieldsEditorProps) {
  const selected = resolveFields(fields);
  const [catalog, setCatalog] = useState<DetailFieldOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCatalog(null);
    setMessage("");
  }, [product]);

  async function loadFields() {
    if (!product.trim()) {
      setMessage("Set the Bugzilla product name first.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const options = await window.bugzilli.getProductDetailFields(product.trim());
      setCatalog(options);
      setMessage(`Loaded ${options.length} fields from Bugzilla.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function toggle(key: string) {
    if (selected.includes(key)) {
      const next = selected.filter((field) => field !== key);
      onChange(next.length > 0 ? next : defaultFields());
      return;
    }
    onChange([...selected, key]);
  }

  function move(key: string, direction: -1 | 1) {
    const index = selected.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= selected.length) return;
    const next = [...selected];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(next);
  }

  const available = catalog ?? selected.map((key) => ({
    key,
    label: fieldLabel(key),
  }));
  const availableKeys = new Set(available.map(({ key }) => key));
  const missingSelected = selected.filter((key) => !availableKeys.has(key));

  return (
    <div className="detail-fields-editor">
      <div className="detail-fields-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="detail-fields-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadFields()}
            disabled={loading}
          >
            <Search size={15} />
            {loading ? "Loading…" : "Load fields from product"}
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => onChange(defaultFields())}
          >
            <RotateCcw size={14} /> Reset to default
          </button>
        </div>
      </div>

      {message && <p className="detail-fields-message">{message}</p>}

      <div className="detail-fields-layout">
        <div className="detail-fields-available">
          <h4>Available</h4>
          <ul>
            {available.map((option) => {
              const checked = selected.includes(option.key);
              return (
                <li key={option.key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(option.key)}
                    />
                    <span>
                      {option.label}
                      <small>{option.key}</small>
                    </span>
                  </label>
                </li>
              );
            })}
            {missingSelected.map((key) => (
              <li key={key}>
                <label>
                  <input
                    type="checkbox"
                    checked
                    onChange={() => toggle(key)}
                  />
                  <span>
                    {fieldLabel(key)}
                    <small>{key}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {!catalog && (
            <p className="detail-fields-hint">
              Showing the default field set. Load fields from this product to
              include custom Bugzilla fields.
            </p>
          )}
        </div>

        <div className="detail-fields-order">
          <h4>Display order</h4>
          <ol>
            {selected.map((key, index) => (
              <li key={key}>
                <span>
                  {fieldLabel(key)}
                  <small>{key}</small>
                </span>
                <span className="detail-fields-order-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${fieldLabel(key)} up`}
                    disabled={index === 0}
                    onClick={() => move(key, -1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${fieldLabel(key)} down`}
                    disabled={index === selected.length - 1}
                    onClick={() => move(key, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
