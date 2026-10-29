import type { FieldControlProps } from "./FieldControlProps";
import { fieldAria, fieldControlClass, FieldShell } from "./FieldShell";

export function SelectFieldControl({
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
  const options =
    value && !values.includes(value) ? [value, ...values] : values;

  return (
    <FieldShell
      id={id}
      label={label}
      icon={icon}
      required={required}
      invalid={invalid}
      error={error}
    >
      <select
        id={id}
        className={fieldControlClass(invalid)}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        {...fieldAria(id, { required, invalid, error })}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
