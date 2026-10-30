import { useState } from "react";
import {
  boardBugGroupValue,
  groupBugsByMappedBoard,
  resolveBoardGroupBy,
  resolveUserBoardColumns,
} from "../../shared/board-statuses";
import type { BoardColumnConfig, Bug } from "../../shared/types";
import { initials, statusClass, userAvatarStyle } from "./BugViewShared";

interface BugBoardProps {
  bugs: Bug[];
  boardGroupBy?: string;
  boardColumns?: BoardColumnConfig[];
  boardStatuses?: string[];
  showClosedBugs?: boolean;
  onSelect: (id: number) => void;
}

export function BugBoard({
  bugs,
  boardGroupBy,
  boardColumns,
  boardStatuses,
  showClosedBugs,
  onSelect,
}: BugBoardProps) {
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(
    () => new Set(),
  );
  const groupBy = resolveBoardGroupBy(boardGroupBy);
  const columns = groupBugsByMappedBoard(bugs, {
    groupBy,
    columns: resolveUserBoardColumns(boardColumns, boardStatuses, groupBy),
    ...(showClosedBugs !== undefined ? { showClosedBugs } : {}),
  });

  return (
    <div className="board">
      {columns.map((column) => {
        const collapsed = collapsedColumns.has(column.id);
        const showGroupValue = Boolean(column.unassigned) || column.values.length > 1;
        return (
          <section
            className={`board-column${collapsed ? " is-collapsed" : ""}${
              column.unassigned ? " is-unassigned" : ""
            }`}
            key={column.id}
            data-column-id={column.id}
          >
            <header>
              <span className={`status-dot ${statusClass(column.name)}`} />
              <h2>
                <button
                  type="button"
                  className="board-column-title"
                  aria-expanded={!collapsed}
                  onClick={() =>
                    setCollapsedColumns((current) => {
                      const next = new Set(current);
                      if (next.has(column.id)) next.delete(column.id);
                      else next.add(column.id);
                      return next;
                    })
                  }
                >
                  {column.name}
                </button>
              </h2>
              <span>{column.bugs.length}</span>
            </header>
            {!collapsed && (
              <div className="board-cards">
                {column.bugs.map((bug) => {
                  const assignee = bug.assignedToName || bug.assignedTo;
                  const groupValue = boardBugGroupValue(bug, groupBy).replaceAll(
                    "_",
                    " ",
                  );
                  return (
                    <button
                      type="button"
                      className="bug-card"
                      key={bug.id}
                      onClick={() => onSelect(bug.id)}
                    >
                      <strong>{bug.summary}</strong>
                      <span className="bug-card-component">{bug.component}</span>
                      {showGroupValue && (
                        <span className="bug-card-group-value">{groupValue}</span>
                      )}
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
