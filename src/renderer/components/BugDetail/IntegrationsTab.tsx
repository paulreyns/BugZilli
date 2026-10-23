import { Plug } from "lucide-react";
import type { BugComment } from "../../../shared/types";
import { CommentList } from "./CommentsTab";

export function IntegrationsTab({
  hidden,
  comments,
}: {
  hidden: boolean;
  comments: BugComment[];
}) {
  return (
    <div className="comments" role="tabpanel" hidden={hidden}>
      <CommentList
        comments={comments}
        icon={<Plug size={28} />}
        emptyText="No integration comments."
      />
    </div>
  );
}
