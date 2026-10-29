import { toDateInputValue } from "../../utils/date";
import type { FieldControlProps } from "./FieldControlProps";
import { fieldAria, fieldControlClass, FieldShell } from "./FieldShell";

export function DateFieldControl({
  id,
  label,
  icon,
  value,
  disabled,
  onChange,
  required,
  invalid,
  error,
}: FieldControlProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      icon={icon}
      required={required}
      invalid={invalid}
      error={error}
    >
      <input
        id={id}
        className={fieldControlClass(invalid)}
        type="date"
        value={toDateInputValue(value)}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        {...fieldAria(id, { required, invalid, error })}
      />
    </FieldShell>
  );
}
