import type { FieldControlProps } from "./FieldControlProps";
import { DateFieldControl } from "./DateFieldControl";
import { DateTimeFieldControl } from "./DateTimeFieldControl";
import { IntegerFieldControl } from "./IntegerFieldControl";
import { MultiSelectFieldControl } from "./MultiSelectFieldControl";
import { SelectFieldControl } from "./SelectFieldControl";
import { TextFieldControl } from "./TextFieldControl";
import { TextareaFieldControl } from "./TextareaFieldControl";

export function FieldControl(props: FieldControlProps) {
  const { type, values } = props;

  if (type === "select" && (values?.length ?? 0) > 0) {
    return <SelectFieldControl {...props} />;
  }

  if (
    (type === "multiselect" || type === "keywords") &&
    (values?.length ?? 0) > 0
  ) {
    return <MultiSelectFieldControl {...props} />;
  }

  switch (type) {
    case "textarea":
      return <TextareaFieldControl {...props} />;
    case "date":
      return <DateFieldControl {...props} />;
    case "datetime":
      return <DateTimeFieldControl {...props} />;
    case "integer":
      return <IntegerFieldControl {...props} />;
    default:
      return <TextFieldControl {...props} />;
  }
}
