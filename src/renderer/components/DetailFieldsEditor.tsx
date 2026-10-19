import {
  defaultDetailFields,
  detailFieldDefinition,
  resolveDetailFields,
} from "../../shared/detail-fields";
import { ProjectFieldsEditor } from "./ProjectFieldsEditor";

interface DetailFieldsEditorProps {
  product: string;
  detailFields: string[] | undefined;
  onChange: (fields: string[]) => void;
}

export function DetailFieldsEditor({
  product,
  detailFields,
  onChange,
}: DetailFieldsEditorProps) {
  return (
    <ProjectFieldsEditor
      title="Bug Details fields"
      description="Choose which fields appear in the Details sidebar and the order they show in."
      product={product}
      fields={detailFields}
      onChange={onChange}
      resolveFields={resolveDetailFields}
      defaultFields={defaultDetailFields}
      fieldLabel={(key) => detailFieldDefinition(key).label}
    />
  );
}
