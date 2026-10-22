import { parseKeywords } from "../../../shared/bug-update";
import type { FieldControlProps } from "./FieldControlProps";

export function MultiSelectFieldControl({
  id,
  label,
  icon,
  value,
  values = [],
  disabled,
  onChange,
}: FieldControlProps) {
  const selected = new Set(parseKeywords(value));

  return (
    <div className="detail-row">
      <span className="detail-label" id={`${id}-label`}>
        {icon} {label}
      </span>
      <div
        className="detail-multiselect"
        role="group"
        aria-labelledby={`${id}-label`}
      >
        {values.map((option) => {
          const checked = selected.has(option);
          return (
            <label key={option} className="detail-multiselect-option">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => {
                  const next = new Set(selected);
                  if (checked) next.delete(option);
                  else next.add(option);
                  onChange([...next].join(", "));
                }}
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
