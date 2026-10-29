import { parseKeywords } from "../../../shared/bug-update";
import type { FieldControlProps } from "./FieldControlProps";
import { fieldAria, FieldShell } from "./FieldShell";

export function MultiSelectFieldControl({
  id,
  label,
  icon,
  value,
  values = [],
  disabled,
  onChange,
  required,
  invalid,
  error,
}: FieldControlProps) {
  const selected = new Set(parseKeywords(value));

  return (
    <FieldShell
      id={id}
      label={label}
      icon={icon}
      required={required}
      invalid={invalid}
      error={error}
      labelAs="span"
    >
      <div
        className={
          invalid
            ? "detail-multiselect detail-multiselect-invalid"
            : "detail-multiselect"
        }
        role="group"
        aria-labelledby={`${id}-label`}
        {...fieldAria(id, { required, invalid, error })}
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
    </FieldShell>
  );
}
