import { ArrowDown, ArrowUp, RotateCcw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import {
  defaultDetailFields,
  detailFieldDefinition,
  resolveDetailFields,
} from "../../shared/detail-fields";
import type { DetailFieldOption } from "../../shared/types";
import { errorMessage } from "../errors";

interface DetailFieldsEditorProps {
  product: string;
  detailFields: string[] | undefined;
  onChange: (fields: string[]) => void;
}

export function DetailFieldsEditor({
  product,
  detailFields,
  onChange,
}: DetailFieldsEditorProps) {
  const selected = resolveDetailFields(detailFields);
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
      setMessage(`Loaded ${options.length} fields from a sample bug.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function toggle(key: string) {
    if (selected.includes(key)) {
      const next = selected.filter((field) => field !== key);
      onChange(next.length > 0 ? next : defaultDetailFields());
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
    label: detailFieldDefinition(key).label,
  }));
  const availableKeys = new Set(available.map(({ key }) => key));
  const missingSelected = selected.filter((key) => !availableKeys.has(key));

  return (
    <div className="detail-fields-editor">
      <div className="detail-fields-header">
        <div>
          <h3>Bug Details fields</h3>
          <p>
            Choose which fields appear in the Details sidebar and the order they
            show in.
          </p>
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
            onClick={() => onChange(defaultDetailFields())}
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
                    {detailFieldDefinition(key).label}
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
                  {detailFieldDefinition(key).label}
                  <small>{key}</small>
                </span>
                <span className="detail-fields-order-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${detailFieldDefinition(key).label} up`}
                    disabled={index === 0}
                    onClick={() => move(key, -1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${detailFieldDefinition(key).label} down`}
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
