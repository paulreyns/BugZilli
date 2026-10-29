import type { FieldControlProps } from "./FieldControlProps";
import { fieldAria, fieldControlClass, FieldShell } from "./FieldShell";

export function IntegerFieldControl({
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
        type="number"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        {...fieldAria(id, { required, invalid, error })}
      />
    </FieldShell>
  );
}
