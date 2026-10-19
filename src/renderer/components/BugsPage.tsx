import { AlertCircle, RefreshCw, Search } from "lucide-react";
import type { Bug, Project } from "../../shared/types";
import type { Page } from "./Sidebar";
import { BugBoard } from "./BugBoard";
import { BugList } from "./BugList";

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
        <BugList
          bugs={bugs}
          {...(project.listColumns ? { listColumns: project.listColumns } : {})}
          onSelect={onSelectBug}
        />
      ) : (
        <BugBoard bugs={bugs} onSelect={onSelectBug} />
      )}
    </main>
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
