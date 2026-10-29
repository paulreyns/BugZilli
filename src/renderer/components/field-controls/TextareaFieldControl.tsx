import type { FieldControlProps } from "./FieldControlProps";
import { fieldAria, fieldControlClass, FieldShell } from "./FieldShell";

export function TextareaFieldControl({
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
      <textarea
        id={id}
        className={fieldControlClass(invalid, "detail-control-textarea")}
        value={value}
        disabled={disabled}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        {...fieldAria(id, { required, invalid, error })}
      />
    </FieldShell>
  );
}
