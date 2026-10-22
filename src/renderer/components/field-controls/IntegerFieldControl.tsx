import type { FieldControlProps } from "./FieldControlProps";

export function IntegerFieldControl({
  id,
  label,
  icon,
  value,
  disabled,
  onChange,
}: FieldControlProps) {
  return (
    <div className="detail-row">
      <label className="detail-label" htmlFor={id}>
        {icon} {label}
      </label>
      <input
        id={id}
        className="detail-control"
        type="number"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
