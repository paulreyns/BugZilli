import type { FieldControlProps } from "./FieldControlProps";

export function TextFieldControl({
  id,
  label,
  icon,
  value,
  values,
  disabled,
  onChange,
}: FieldControlProps) {
  const suggestions = values?.length ? values : undefined;

  return (
    <div className="detail-row">
      <label className="detail-label" htmlFor={id}>
        {icon} {label}
      </label>
      <input
        id={id}
        className="detail-control"
        value={value}
        disabled={disabled}
        spellCheck={suggestions === undefined}
        onChange={(event) => onChange(event.target.value)}
        {...(suggestions ? { list: `${id}-options` } : {})}
      />
      {suggestions && (
        <datalist id={`${id}-options`}>
          {suggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </div>
  );
}
