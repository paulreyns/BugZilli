import type { FieldControlProps } from "./FieldControlProps";

export function TextareaFieldControl({
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
      <textarea
        id={id}
        className="detail-control detail-control-textarea"
        value={value}
        disabled={disabled}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
