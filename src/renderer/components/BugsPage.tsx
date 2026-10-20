import { AlertCircle, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { ALL_FILTER_ID } from "../../shared/list-filters";
import type { Bug, Project, SavedFilter } from "../../shared/types";
import type { Page } from "./Sidebar";
import { AddFilterDialog } from "./AddFilterDialog";
import { BugBoard } from "./BugBoard";
import { BugList } from "./BugList";
import { FilterSelect } from "./FilterSelect";

interface BugsPageProps {
  project: Project;
  mode: Extract<Page, "list" | "board">;
  bugs: Bug[];
  query: string;
  selectedFilterId: string;
  loading: boolean;
  error: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onRefresh: () => void;
  onSelectFilter: (filterId: string) => void;
  onAddFilter: (filter: SavedFilter) => void;
  onUpdateFilter: (filter: SavedFilter) => void;
  onDeleteFilter: (filterId: string) => void;
  onSelectBug: (id: number) => void;
}

export function BugsPage(props: BugsPageProps) {
  const {
    project,
    mode,
    bugs,
    query,
    selectedFilterId,
    loading,
    error,
    onQueryChange,
    onSearch,
    onRefresh,
    onSelectFilter,
    onAddFilter,
    onUpdateFilter,
    onDeleteFilter,
    onSelectBug,
  } = props;
  const [filterDialog, setFilterDialog] = useState<
    { mode: "add" } | { mode: "edit"; filter: SavedFilter } | null
  >(null);

  const selectedFilter =
    selectedFilterId !== ALL_FILTER_ID
      ? project.filters?.find((filter) => filter.id === selectedFilterId)
      : undefined;

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

      <div className="bugs-toolbar">
        <FilterSelect
          filters={project.filters ?? []}
          selectedId={selectedFilterId}
          onSelect={onSelectFilter}
          onAddFilter={() => setFilterDialog({ mode: "add" })}
          onEditFilter={() => {
            if (!selectedFilter) return;
            setFilterDialog({ mode: "edit", filter: selectedFilter });
          }}
          onDeleteFilter={() => {
            if (!selectedFilter) return;
            onDeleteFilter(selectedFilter.id);
          }}
          disabled={loading}
        />
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
      </div>

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
          product={project.product}
          {...(project.listColumns ? { listColumns: project.listColumns } : {})}
          onSelect={onSelectBug}
        />
      ) : (
        <BugBoard bugs={bugs} onSelect={onSelectBug} />
      )}

      {filterDialog && (
        <AddFilterDialog
          product={project.product}
          {...(filterDialog.mode === "edit"
            ? { initialFilter: filterDialog.filter }
            : {})}
          onClose={() => setFilterDialog(null)}
          onSave={(filter) => {
            setFilterDialog(null);
            if (filterDialog.mode === "edit") {
              onUpdateFilter(filter);
            } else {
              onAddFilter(filter);
            }
          }}
        />
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
