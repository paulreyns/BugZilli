import { useState } from "react";
import { groupBugsByBoard } from "../../shared/board-statuses";
import type { Bug } from "../../shared/types";
import { initials, statusClass, userAvatarStyle } from "./BugViewShared";

interface BugBoardProps {
  bugs: Bug[];
  boardGroupBy?: string;
  boardStatuses?: string[];
  showClosedBugs?: boolean;
  onSelect: (id: number) => void;
}

export function BugBoard({
  bugs,
  boardGroupBy,
  boardStatuses,
  showClosedBugs,
  onSelect,
}: BugBoardProps) {
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(
    () => new Set(),
  );
  const columns = groupBugsByBoard(
    {
      ...(boardGroupBy !== undefined ? { groupBy: boardGroupBy } : {}),
      ...(boardStatuses !== undefined ? { columns: boardStatuses } : {}),
      ...(showClosedBugs !== undefined ? { showClosedBugs } : {}),
    },
    bugs,
  );

  return (
    <div className="board">
      {columns.map(({ status, bugs: statusBugs }) => {
        const collapsed = collapsedColumns.has(status);
        const title = status.replaceAll("_", " ");
        return (
          <section
            className={`board-column${collapsed ? " is-collapsed" : ""}`}
            key={status}
          >
            <header>
              <span className={`status-dot ${statusClass(status)}`} />
              <h2>
                <button
                  type="button"
                  className="board-column-title"
                  aria-expanded={!collapsed}
                  onClick={() =>
                    setCollapsedColumns((current) => {
                      const next = new Set(current);
                      if (next.has(status)) next.delete(status);
                      else next.add(status);
                      return next;
                    })
                  }
                >
                  {title}
                </button>
              </h2>
              <span>{statusBugs.length}</span>
            </header>
            {!collapsed && (
              <div className="board-cards">
                {statusBugs.map((bug) => {
                  const assignee = bug.assignedToName || bug.assignedTo;
                  return (
                    <button
                      type="button"
                      className="bug-card"
                      key={bug.id}
                      onClick={() => onSelect(bug.id)}
                    >
                      <strong>{bug.summary}</strong>
                      <span className="bug-card-component">
                        {bug.component}
                      </span>
                      <footer>
                        <span className="bug-key">{bug.id}</span>
                        <span
                          className="avatar"
                          title={assignee}
                          style={userAvatarStyle(
                            bug.assignedTo || assignee || "",
                          )}
                        >
                          {initials(assignee || "") || "?"}
                        </span>
                      </footer>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
