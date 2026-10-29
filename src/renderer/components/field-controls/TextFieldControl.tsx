import type { FieldControlProps } from "./FieldControlProps";
import { fieldAria, fieldControlClass, FieldShell } from "./FieldShell";

export function TextFieldControl({
  id,
  label,
  icon,
  value,
  values,
  disabled,
  onChange,
  required,
  invalid,
  error,
}: FieldControlProps) {
  const suggestions = values?.length ? values : undefined;

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
        value={value}
        disabled={disabled}
        spellCheck={suggestions === undefined}
        onChange={(event) => onChange(event.target.value)}
        {...fieldAria(id, { required, invalid, error })}
        {...(suggestions ? { list: `${id}-options` } : {})}
      />
      {suggestions && (
        <datalist id={`${id}-options`}>
          {suggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </FieldShell>
  );
}
