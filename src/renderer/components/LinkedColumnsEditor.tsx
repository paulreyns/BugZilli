import { detailFieldDefinition } from "../../shared/detail-fields";
import {
  defaultLinkedColumns,
  resolveLinkedColumns,
} from "../../shared/linked-columns";
import { ProjectFieldsEditor } from "./ProjectFieldsEditor";

interface LinkedColumnsEditorProps {
  product: string;
  linkedColumns: string[] | undefined;
  onChange: (columns: string[]) => void;
}

export function LinkedColumnsEditor({
  product,
  linkedColumns,
  onChange,
}: LinkedColumnsEditorProps) {
  return (
    <ProjectFieldsEditor
      title="Linked Bugs columns"
      description="Choose which columns appear in the Blocks and Depends On tables and the order they show in."
      product={product}
      fields={linkedColumns}
      onChange={onChange}
      resolveFields={resolveLinkedColumns}
      defaultFields={defaultLinkedColumns}
      fieldLabel={(key) => detailFieldDefinition(key).label}
    />
  );
}
