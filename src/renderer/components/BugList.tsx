import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ChevronsUpDown,
  CircleUserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  detailFieldDefinition,
  formatExtraFieldValue,
  readBugFieldValue,
} from "../../shared/detail-fields";
import { resolveListColumns } from "../../shared/list-columns";
import {
  nextSort,
  parseListSorts,
  sortBugs,
  type ListSort,
  type ListSortsByProduct,
} from "../../shared/list-sort";
import type { Bug } from "../../shared/types";
import { formatListDate } from "../utils/date";
import {
  EmptyState,
  initials,
  statusClass,
  userAvatarStyle,
} from "./BugViewShared";

const LIST_SORTS_KEY = "bugzilli.listSorts";

interface BugListProps {
  bugs: Bug[];
  product: string;
  listColumns?: string[];
  onSelect: (id: number) => void;
}

function readListSorts(): ListSortsByProduct {
  try {
    const saved = localStorage.getItem(LIST_SORTS_KEY);
    return saved ? parseListSorts(JSON.parse(saved)) : {};
  } catch (error) {
    console.error("Could not read saved list sorting.", error);
    return {};
  }
}

function useProductListSort(
  product: string,
): [ListSort | undefined, (sort: ListSort | undefined) => void] {
  const [sorts, setSorts] = useState(readListSorts);

  useEffect(() => {
    try {
      localStorage.setItem(LIST_SORTS_KEY, JSON.stringify(sorts));
    } catch (error) {
      console.error("Could not save list sorting.", error);
    }
  }, [sorts]);

  function setSort(sort: ListSort | undefined) {
    setSorts((current) => {
      const next = { ...current };
      if (sort) next[product] = sort;
      else delete next[product];
      return next;
    });
  }

  return [sorts[product], setSort];
}

function isDateColumn(key: string): boolean {
  return (
    detailFieldDefinition(key).format === "date" ||
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
          <span
            className="avatar"
            title={assignee}
            style={userAvatarStyle(bug.assignedTo || assignee)}
          >
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
        return <>{formatListDate(raw)}</>;
      }
      const formatted = formatExtraFieldValue(raw).trim();
      return <>{formatted || "—"}</>;
    }
  }
}

export function BugList({
  bugs,
  product,
  listColumns,
  onSelect,
}: BugListProps) {
  const columns = resolveListColumns(listColumns);
  const [savedSort, setSort] = useProductListSort(product);
  const sort =
    savedSort && columns.includes(savedSort.column) ? savedSort : undefined;
  const sortedBugs = useMemo(() => sortBugs(bugs, sort), [bugs, sort]);

  if (bugs.length === 0) return <EmptyState />;
  return (
    <div className="issue-table-wrap">
      <table className="issue-table">
        <thead>
          <tr>
            {columns.map((column) => {
              const direction =
                sort?.column === column ? sort.direction : undefined;
              const SortIcon =
                direction === "asc"
                  ? ArrowUp
                  : direction === "desc"
                    ? ArrowDown
                    : ChevronsUpDown;
              return (
                <th
                  key={column}
                  aria-sort={
                    direction === "asc"
                      ? "ascending"
                      : direction === "desc"
                        ? "descending"
                        : undefined
                  }
                >
                  <button
                    type="button"
                    className={`sort-button${direction ? " sorted" : ""}`}
                    onClick={() => setSort(nextSort(sort, column))}
                  >
                    {detailFieldDefinition(column).label}
                    <SortIcon size={12} aria-hidden="true" />
                  </button>
                </th>
              );
            })}
            <th aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {sortedBugs.map((bug) => (
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
