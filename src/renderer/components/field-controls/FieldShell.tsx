import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export function RequiredMark() {
  return (
    <span className="required-mark">
      <span aria-hidden="true">*</span>
      <span className="visually-hidden"> required</span>
    </span>
  );
}

export function fieldControlClass(invalid?: boolean, extra?: string): string {
  return ["detail-control", extra, invalid ? "detail-control-invalid" : ""]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

export function fieldAria(
  id: string,
  props: {
    required?: boolean | undefined;
    invalid?: boolean | undefined;
    error?: string | undefined;
  },
): {
  "aria-required"?: true;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
} {
  return {
    ...(props.required ? { "aria-required": true as const } : {}),
    ...(props.invalid ? { "aria-invalid": true as const } : {}),
    ...(props.error ? { "aria-describedby": `${id}-error` } : {}),
  };
}

export function FieldShell({
  id,
  label,
  icon,
  required = false,
  invalid = false,
  error,
  labelAs = "label",
  children,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  required?: boolean | undefined;
  invalid?: boolean | undefined;
  error?: string | undefined;
  labelAs?: "label" | "span";
  children: ReactNode;
}) {
  const labelContent = (
    <>
      {icon}
      <span>{label}</span>
      {required ? <RequiredMark /> : null}
      {invalid ? (
        <AlertCircle className="field-error-icon" size={12} aria-hidden="true" />
      ) : null}
    </>
  );

  return (
    <div className={invalid ? "detail-row detail-row-invalid" : "detail-row"}>
      {labelAs === "span" ? (
        <span className="detail-label" id={`${id}-label`}>
          {labelContent}
        </span>
      ) : (
        <label className="detail-label" htmlFor={id}>
          {labelContent}
        </label>
      )}
      {children}
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
