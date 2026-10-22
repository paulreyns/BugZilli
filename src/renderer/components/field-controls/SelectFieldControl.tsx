import type { FieldControlProps } from "./FieldControlProps";

export function SelectFieldControl({
  id,
  label,
  icon,
  value,
  values = [],
  disabled,
  onChange,
}: FieldControlProps) {
  const options =
    value && !values.includes(value) ? [value, ...values] : values;

  return (
    <div className="detail-row">
      <label className="detail-label" htmlFor={id}>
        {icon} {label}
      </label>
      <select
        id={id}
        className="detail-control"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
