import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  LayoutList,
  RefreshCw,
  Search,
} from "lucide-react";
import type { Bug, Project } from "../../shared/types";
import type { Page } from "./Sidebar";

interface BugsPageProps {
  project: Project;
  mode: Extract<Page, "list" | "board">;
  bugs: Bug[];
  query: string;
  loading: boolean;
  error: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onRefresh: () => void;
  onSelectBug: (id: number) => void;
}

function displayDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function initials(value: string): string {
  const name = value.split("@")[0] ?? value;
  return name
    .split(/[._\s-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (/(resolved|closed|verified)/.test(normalized)) return "status-done";
  if (/(progress|assigned|reopened)/.test(normalized)) return "status-progress";
  return "status-todo";
}

export function BugsPage(props: BugsPageProps) {
  const {
    project,
    mode,
    bugs,
    query,
    loading,
    error,
    onQueryChange,
    onSearch,
    onRefresh,
    onSelectBug,
  } = props;

  return (
    <main className="page bugs-page">
      <header className="page-header list-header">
        <div>
          <p className="breadcrumbs">Projects / {project.name}</p>
          <h1>{mode === "list" ? "Issues" : "Board"}</h1>
          <p className="page-subtitle">
            {project.product} · {bugs.length} issues
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? "spin" : ""} />
          Refresh
        </button>
      </header>

      <form
        className="search-bar"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search issues by ID, summary, or keywords"
          aria-label="Search issues"
        />
        {query && (
          <button className="search-submit" type="submit">
            Search
          </button>
        )}
      </form>

      {error && (
        <div className="error-banner">
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      {loading ? (
        <LoadingRows />
      ) : mode === "list" ? (
        <BugList bugs={bugs} onSelect={onSelectBug} />
      ) : (
        <BugBoard bugs={bugs} onSelect={onSelectBug} />
      )}
    </main>
  );
}

function BugList({
  bugs,
  onSelect,
}: {
  bugs: Bug[];
  onSelect: (id: number) => void;
}) {
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
                  BZ-{bug.id}
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

function BugBoard({
  bugs,
  onSelect,
}: {
  bugs: Bug[];
  onSelect: (id: number) => void;
}) {
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
                  <span className="bug-key">BZ-{bug.id}</span>
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

function EmptyState() {
  return (
    <div className="empty-state">
      <LayoutList size={36} />
      <h2>No issues found</h2>
      <p>Try changing your search or check the project product name.</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="loading-list" aria-label="Loading issues">
      {Array.from({ length: 7 }, (_, index) => (
        <div className="loading-row" key={index}>
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
