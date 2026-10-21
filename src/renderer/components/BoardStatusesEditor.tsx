import { ArrowDown, ArrowUp, RotateCcw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CLOSED_BOARD_STATUS,
  DEFAULT_BOARD_GROUP_BY,
  boardGroupByFields,
  defaultColumnsForGroupBy,
  resolveBoardGroupBy,
  resolveBoardStatuses,
} from "../../shared/board-statuses";
import { detailFieldDefinition } from "../../shared/detail-fields";
import type { DetailFieldOption } from "../../shared/types";
import { errorMessage } from "../errors";

interface BoardStatusesEditorProps {
  product: string;
  boardGroupBy: string | undefined;
  boardStatuses: string[] | undefined;
  showClosedBugs: boolean;
  onGroupByChange: (groupBy: string, columns: string[]) => void;
  onColumnsChange: (statuses: string[]) => void;
}

/** Offline defaults: common selects that have built-in value lists. */
const BUILTIN_GROUP_BY_FIELDS: DetailFieldOption[] = boardGroupByFields([
  { key: "status", label: "Status", type: "select" },
  { key: "priority", label: "Priority", type: "select" },
  { key: "severity", label: "Severity", type: "select" },
  { key: "resolution", label: "Resolution", type: "select" },
]);

export function BoardStatusesEditor({
  product,
  boardGroupBy,
  boardStatuses,
  showClosedBugs,
  onGroupByChange,
  onColumnsChange,
}: BoardStatusesEditorProps) {
  const groupBy = resolveBoardGroupBy(boardGroupBy);
  const [catalog, setCatalog] = useState<DetailFieldOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCatalog(null);
    setMessage("");
  }, [product]);

  const groupByOptions = catalog ?? BUILTIN_GROUP_BY_FIELDS;
  const selectedOption =
    groupByOptions.find((option) => option.key === groupBy) ??
    ({
      key: groupBy,
      label: detailFieldDefinition(groupBy).label,
      type: "select" as const,
      values: defaultColumnsForGroupBy(groupBy),
    } satisfies DetailFieldOption);

  const columnDefaults =
    selectedOption.values && selectedOption.values.length > 0
      ? selectedOption.values
      : defaultColumnsForGroupBy(groupBy);
  const selected = resolveBoardStatuses(
    boardStatuses?.length ? boardStatuses : columnDefaults,
    groupBy,
  );

  async function loadFields() {
    if (!product.trim()) {
      setMessage("Set the Bugzilla product name first.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const options = await window.bugzilli.getProductDetailFields(product.trim());
      const fields = boardGroupByFields(options);
      setCatalog(fields);
      setMessage(
        `Loaded ${fields.length} selectable fields with defined values.`,
      );

      // Refresh column defaults for the current group-by from live values.
      const current = fields.find((option) => option.key === groupBy);
      if (current?.values?.length && (!boardStatuses || boardStatuses.length === 0)) {
        onColumnsChange(current.values);
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function selectGroupBy(nextKey: string) {
    const key = resolveBoardGroupBy(nextKey);
    if (key === groupBy) return;
    const option = groupByOptions.find((entry) => entry.key === key);
    const columns =
      option?.values && option.values.length > 0
        ? option.values
        : defaultColumnsForGroupBy(key);
    onGroupByChange(key, columns);
  }

  function move(status: string, direction: -1 | 1) {
    const index = selected.indexOf(status);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= selected.length) return;
    const next = [...selected];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onColumnsChange(next);
  }

  const groupByLabel = selectedOption.label;
  const missingGroupBy =
    !groupByOptions.some((option) => option.key === groupBy) &&
    groupBy !== DEFAULT_BOARD_GROUP_BY;

  return (
    <div className="detail-fields-editor">
      <div className="detail-fields-header">
        <div>
          <h3>Board columns</h3>
          <p>
            Choose which field groups the Board, then set the column order.
            Only fields with a fixed list of values (select / combo / lookup)
            are available.
          </p>
        </div>
        <div className="detail-fields-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadFields()}
            disabled={loading}
          >
            <Search size={15} />
            {loading ? "Loading…" : "Load fields from product"}
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              onGroupByChange(DEFAULT_BOARD_GROUP_BY, defaultColumnsForGroupBy(DEFAULT_BOARD_GROUP_BY))
            }
          >
            <RotateCcw size={14} /> Reset to status
          </button>
        </div>
      </div>

      {message && <p className="detail-fields-message">{message}</p>}

      <label className="board-group-by">
        Group board by
        <select
          value={groupBy}
          onChange={(event) => selectGroupBy(event.target.value)}
        >
          {missingGroupBy && (
            <option value={groupBy}>{groupByLabel}</option>
          )}
          {groupByOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <small>
          {catalog
            ? "Showing selectable fields loaded from this Bugzilla product."
            : "Showing common select fields. Load fields from this product to include custom Bugzilla fields."}
        </small>
      </label>

      <div className="detail-fields-header board-column-order-header">
        <div>
          <h3>Board column order</h3>
          <p>
            Choose the order of {groupByLabel.toLowerCase()} columns on the
            Board. Every value is shown even when it has no issues.
          </p>
        </div>
        <div className="detail-fields-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => onColumnsChange(columnDefaults)}
            disabled={columnDefaults.length === 0}
          >
            <RotateCcw size={14} /> Reset order
          </button>
        </div>
      </div>

      <div className="detail-fields-layout board-statuses-layout">
        <div className="detail-fields-order">
          <h4>Display order</h4>
          {selected.length === 0 ? (
            <p className="detail-fields-hint">
              No defined values for this field yet. Load fields from the
              product, or pick another group-by field.
            </p>
          ) : (
            <ol>
              {selected.map((status, index) => {
                const isClosed =
                  groupBy === DEFAULT_BOARD_GROUP_BY &&
                  status.toUpperCase() === CLOSED_BOARD_STATUS;
                const hiddenOnBoard = isClosed && !showClosedBugs;
                return (
                  <li
                    key={status}
                    className={hiddenOnBoard ? "board-status-hidden" : undefined}
                  >
                    <span>
                      {status.replaceAll("_", " ")}
                      <small>
                        {status}
                        {hiddenOnBoard
                          ? " · hidden until Show closed bugs is enabled"
                          : ""}
                      </small>
                    </span>
                    <span className="detail-fields-order-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Move ${status} up`}
                        disabled={index === 0}
                        onClick={() => move(status, -1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Move ${status} down`}
                        disabled={index === selected.length - 1}
                        onClick={() => move(status, 1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
