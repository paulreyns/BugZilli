import type { Bug } from "../../shared/types";
import { EmptyState, initials, statusClass } from "./BugViewShared";

interface BugBoardProps {
  bugs: Bug[];
  onSelect: (id: number) => void;
}

export function BugBoard({ bugs, onSelect }: BugBoardProps) {
  if (bugs.length === 0) return <EmptyState />;
  const groups = new Map<string, Bug[]>();
  for (const bug of bugs) {
    const values = groups.get(bug.status) ?? [];
    values.push(bug);
    groups.set(bug.status, values);
  }

  return (
    <div className="board">
      {[...groups.entries()].map(([status, statusBugs]) => (
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
