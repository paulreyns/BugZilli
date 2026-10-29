import type { ReactNode } from "react";
import type { DetailFieldType } from "../../../shared/types";

export interface FieldControlProps {
  id: string;
  label: string;
  icon: ReactNode;
  value: string;
  type?: DetailFieldType | undefined;
  values?: string[] | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
  /** Show a red asterisk. Used when Bugzilla marks the field mandatory. */
  required?: boolean | undefined;
  /** Show a red indicator and invalid styling. */
  invalid?: boolean | undefined;
  /** Message announced with the invalid field. */
  error?: string | undefined;
}
