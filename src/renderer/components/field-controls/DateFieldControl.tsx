import { toDateInputValue } from "../../utils/date";
import type { FieldControlProps } from "./FieldControlProps";

export function DateFieldControl({
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
        type="date"
        value={toDateInputValue(value)}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
