import {
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from "../../utils/date";
import type { FieldControlProps } from "./FieldControlProps";

export function DateTimeFieldControl({
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
        type="datetime-local"
        value={toDateTimeLocalValue(value)}
        disabled={disabled}
        onChange={(event) =>
          onChange(fromDateTimeLocalValue(event.target.value))
        }
      />
    </div>
  );
}
