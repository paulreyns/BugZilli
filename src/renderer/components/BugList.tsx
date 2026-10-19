import { AlertCircle, ChevronRight, CircleUserRound } from "lucide-react";
import {
  formatExtraFieldValue,
  readBugFieldValue,
} from "../../shared/detail-fields";
import {
  listColumnDefinition,
  resolveListColumns,
} from "../../shared/list-columns";
import type { Bug } from "../../shared/types";
import { EmptyState, initials, statusClass } from "./BugViewShared";

interface BugListProps {
  bugs: Bug[];
  listColumns?: string[];
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

function isDateColumn(key: string): boolean {
  return (
    listColumnDefinition(key).format === "date" ||
    key === "creationTime" ||
    key === "lastChangeTime" ||
    key === "deadline"
  );
}

function ColumnCell({ bug, column }: { bug: Bug; column: string }) {
  switch (column) {
    case "id":
      return (
        <span className="bug-key">
          <span className="bug-type-icon">
            <AlertCircle size={12} />
          </span>
          {bug.id}
        </span>
      );
    case "summary":
      return (
        <>
          <strong>{bug.summary}</strong>
          {bug.component ? <span>{bug.component}</span> : null}
        </>
      );
    case "assignedTo": {
      const assignee = bug.assignedToName || bug.assignedTo;
      return (
        <span className="assignee">
          <span className="avatar">
            {initials(assignee) || <CircleUserRound size={16} />}
          </span>
          {assignee || "Unassigned"}
        </span>
      );
    }
    case "status":
      return (
        <span className={`status-pill ${statusClass(bug.status)}`}>
          {(bug.status || "—").replaceAll("_", " ")}
        </span>
      );
    default: {
      const raw = readBugFieldValue(bug, column);
      if (isDateColumn(column) && typeof raw === "string") {
        return <>{displayDate(raw)}</>;
      }
      const formatted = formatExtraFieldValue(raw).trim();
      return <>{formatted || "—"}</>;
    }
  }
}

export function BugList({ bugs, listColumns, onSelect }: BugListProps) {
  const columns = resolveListColumns(listColumns);

  if (bugs.length === 0) return <EmptyState />;
  return (
    <div className="issue-table-wrap">
      <table className="issue-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{listColumnDefinition(column).label}</th>
            ))}
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
              {columns.map((column) => (
                <td
                  key={column}
                  className={column === "summary" ? "summary-cell" : undefined}
                >
                  <ColumnCell bug={bug} column={column} />
                </td>
              ))}
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
