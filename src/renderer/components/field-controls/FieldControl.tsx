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
  const hasValues = (values?.length ?? 0) > 0;

  // Legal values win over a missing/unknown type: Bugzilla marks some
  // select-backed fields (e.g. target_milestone, version) as type 0.
  if (
    hasValues &&
    (type === "select" || type === "unknown" || type === undefined)
  ) {
    return <SelectFieldControl {...props} />;
  }

  if (hasValues && (type === "multiselect" || type === "keywords")) {
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
