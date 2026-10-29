import {
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from "../../utils/date";
import type { FieldControlProps } from "./FieldControlProps";
import { fieldAria, fieldControlClass, FieldShell } from "./FieldShell";

export function DateTimeFieldControl({
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
        type="datetime-local"
        value={toDateTimeLocalValue(value)}
        disabled={disabled}
        onChange={(event) =>
          onChange(fromDateTimeLocalValue(event.target.value))
        }
        {...fieldAria(id, { required, invalid, error })}
      />
    </FieldShell>
  );
}
