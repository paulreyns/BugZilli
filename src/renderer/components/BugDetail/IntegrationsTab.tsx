import { Plug } from "lucide-react";
import type { BugComment } from "../../../shared/types";
import { CommentList } from "./CommentsTab";

export function IntegrationsTab({
  hidden,
  comments,
  baseUrl,
  bugId,
}: {
  hidden: boolean;
  comments: BugComment[];
  baseUrl?: string;
  bugId?: number;
}) {
  return (
    <div className="comments" role="tabpanel" hidden={hidden}>
      <CommentList
        comments={comments}
        icon={<Plug size={28} />}
        emptyText="No integration comments."
        {...(baseUrl ? { baseUrl } : {})}
        {...(bugId !== undefined ? { bugId } : {})}
      />
    </div>
  );
}
