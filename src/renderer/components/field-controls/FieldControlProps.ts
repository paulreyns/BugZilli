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
}
