import { AlertCircle, ChevronRight, CircleUserRound } from "lucide-react";
import type { Bug } from "../../shared/types";
import { EmptyState, initials, statusClass } from "./BugViewShared";

interface BugListProps {
  bugs: Bug[];
  onSelect: (id: number) => void;
}

function displayDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function BugList({ bugs, onSelect }: BugListProps) {
  if (bugs.length === 0) return <EmptyState />;
  return (
    <div className="issue-table-wrap">
      <table className="issue-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Summary</th>
            <th>Assignee</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Updated</th>
            <th aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {bugs.map((bug) => (
            <tr
              key={bug.id}
              onClick={() => onSelect(bug.id)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSelect(bug.id);
              }}
            >
              <td>
                <span className="bug-key">
                  <span className="bug-type-icon">
                    <AlertCircle size={12} />
                  </span>
                  {bug.id}
                </span>
              </td>
              <td className="summary-cell">
                <strong>{bug.summary}</strong>
                <span>{bug.component}</span>
              </td>
              <td>
                <span className="assignee">
                  <span className="avatar">
                    {initials(bug.assignedTo) || <CircleUserRound size={16} />}
                  </span>
                  {bug.assignedTo || "Unassigned"}
                </span>
              </td>
              <td>{bug.priority || "—"}</td>
              <td>
                <span className={`status-pill ${statusClass(bug.status)}`}>
                  {bug.status.replaceAll("_", " ")}
                </span>
              </td>
              <td>{displayDate(bug.lastChangeTime)}</td>
              <td>
                <ChevronRight size={16} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
