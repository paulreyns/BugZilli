import { detailFieldDefinition } from "../../shared/detail-fields";
import {
  defaultListColumns,
  resolveListColumns,
} from "../../shared/list-columns";
import { ProjectFieldsEditor } from "./ProjectFieldsEditor";

interface ListColumnsEditorProps {
  product: string;
  listColumns: string[] | undefined;
  onChange: (columns: string[]) => void;
}

export function ListColumnsEditor({
  product,
  listColumns,
  onChange,
}: ListColumnsEditorProps) {
  return (
    <ProjectFieldsEditor
      title="Bug List columns"
      description="Choose which columns appear in the Issues table and the order they show in."
      product={product}
      fields={listColumns}
      onChange={onChange}
      resolveFields={resolveListColumns}
      defaultFields={defaultListColumns}
      fieldLabel={(key) => detailFieldDefinition(key).label}
    />
  );
}
