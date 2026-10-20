import { groupBugsByBoardStatus } from "../../shared/board-statuses";
import type { Bug } from "../../shared/types";
import { initials, statusClass } from "./BugViewShared";

interface BugBoardProps {
  bugs: Bug[];
  boardStatuses?: string[];
  showClosedBugs?: boolean;
  onSelect: (id: number) => void;
}

export function BugBoard({
  bugs,
  boardStatuses,
  showClosedBugs,
  onSelect,
}: BugBoardProps) {
  const columns = groupBugsByBoardStatus(bugs, boardStatuses, showClosedBugs);

  return (
    <div className="board">
      {columns.map(({ status, bugs: statusBugs }) => (
        <section className="board-column" key={status}>
          <header>
            <span className={`status-dot ${statusClass(status)}`} />
            <h2>{status.replaceAll("_", " ")}</h2>
            <span>{statusBugs.length}</span>
          </header>
          <div className="board-cards">
            {statusBugs.map((bug) => (
              <button
                type="button"
                className="bug-card"
                key={bug.id}
                onClick={() => onSelect(bug.id)}
              >
                <strong>{bug.summary}</strong>
                <span className="bug-card-component">{bug.component}</span>
                <footer>
                  <span className="bug-key">{bug.id}</span>
                  <span className="avatar">
                    {initials(bug.assignedTo) || "?"}
                  </span>
                </footer>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
