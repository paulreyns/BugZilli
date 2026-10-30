import { ChevronLeft, ChevronRight, GripVertical, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_BOARD_GROUP_BY,
  UNASSIGNED_BOARD_COLUMN_ID,
  UNASSIGNED_BOARD_COLUMN_NAME,
  boardGroupByFields,
  boardValueIdentity,
  clearBoardColumnValues,
  createBoardColumn,
  defaultColumnsForGroupBy,
  moveBoardColumn,
  moveBoardValue,
  resolveBoardGroupBy,
  resolveUserBoardColumns,
  unassignedBoardValues,
} from "../../shared/board-statuses";
import { detailFieldDefinition } from "../../shared/detail-fields";
import type { BoardColumnConfig, DetailFieldOption } from "../../shared/types";
import { errorMessage } from "../errors";

interface BoardColumnsEditorProps {
  product: string;
  boardGroupBy: string | undefined;
  boardColumns: BoardColumnConfig[] | undefined;
  boardStatuses: string[] | undefined;
  showClosedBugs: boolean;
  onChange: (update: {
    boardGroupBy: string;
    boardColumns: BoardColumnConfig[];
  }) => void;
}

interface ValueDrag {
  value: string;
  fromColumnId: string;
}

/** Offline defaults: common selects that have built-in value lists. */
const BUILTIN_GROUP_BY_FIELDS: DetailFieldOption[] = boardGroupByFields([
  { key: "status", label: "Status", type: "select" },
  { key: "priority", label: "Priority", type: "select" },
  { key: "severity", label: "Severity", type: "select" },
  { key: "resolution", label: "Resolution", type: "select" },
]);

const MAX_COLUMN_NAME_LENGTH = 80;

export function BoardColumnsEditor({
  product,
  boardGroupBy,
  boardColumns,
  boardStatuses,
  showClosedBugs,
  onChange,
}: BoardColumnsEditorProps) {
  const groupBy = resolveBoardGroupBy(boardGroupBy);
  const [catalog, setCatalog] = useState<DetailFieldOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [draggingValue, setDraggingValue] = useState<string | null>(null);
  const [dropColumnId, setDropColumnId] = useState<string | null>(null);
  const dragRef = useRef<ValueDrag | null>(null);
  const addLock = useRef(false);
  const renameLock = useRef(false);

  useEffect(() => {
    setCatalog(null);
    setMessage("");
    setAdding(false);
    setDraftName("");
    setEditingId(null);
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

  const fieldValues =
    selectedOption.values && selectedOption.values.length > 0
      ? selectedOption.values
      : defaultColumnsForGroupBy(groupBy);
  const columns = resolveUserBoardColumns(boardColumns, boardStatuses, groupBy);
  const unassigned = unassignedBoardValues(groupBy, fieldValues, columns);
  const groupByLabel = selectedOption.label;
  const missingGroupBy =
    !groupByOptions.some((option) => option.key === groupBy) &&
    groupBy !== DEFAULT_BOARD_GROUP_BY;

  function commit(nextColumns: BoardColumnConfig[], nextGroupBy = groupBy) {
    onChange({ boardGroupBy: nextGroupBy, boardColumns: nextColumns });
  }

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
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function selectGroupBy(nextKey: string) {
    const key = resolveBoardGroupBy(nextKey);
    if (key === groupBy) return;
    setAdding(false);
    setDraftName("");
    setEditingId(null);
    setMessage("");
    commit(clearBoardColumnValues(columns), key);
  }

  function columnNameError(name: string): string | null {
    const trimmed = name.trim();
    if (!trimmed) return "Enter a column name.";
    if (trimmed.length > MAX_COLUMN_NAME_LENGTH) {
      return "Column names must be 80 characters or fewer.";
    }
    return null;
  }

  function commitAdd() {
    if (addLock.current) return;
    const error = columnNameError(draftName);
    if (error) {
      setMessage(error);
      if (!draftName.trim()) setAdding(false);
      return;
    }
    addLock.current = true;
    commit([...columns, createBoardColumn(draftName)]);
    setDraftName("");
    setAdding(false);
    setMessage("");
  }

  function commitRename(columnId: string) {
    if (renameLock.current) return;
    const column = columns.find((entry) => entry.id === columnId);
    if (!column) {
      setEditingId(null);
      return;
    }
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === column.name) {
      renameLock.current = true;
      setEditingId(null);
      return;
    }
    const error = columnNameError(trimmed);
    if (error) {
      renameLock.current = true;
      setEditingId(null);
      setMessage(error);
      return;
    }
    renameLock.current = true;
    setEditingId(null);
    setMessage("");
    commit(
      columns.map((entry) =>
        entry.id === columnId ? { ...entry, name: trimmed } : entry,
      ),
    );
  }

  function beginValueDrag(
    event: React.DragEvent<HTMLElement>,
    value: string,
    fromColumnId: string,
  ) {
    if (event.dataTransfer) {
      event.dataTransfer.setData("text/plain", value);
      event.dataTransfer.effectAllowed = "move";
    }
    const payload = { value, fromColumnId };
    dragRef.current = payload;
    setDraggingValue(value);
  }

  function endValueDrag() {
    dragRef.current = null;
    setDraggingValue(null);
    setDropColumnId(null);
  }

  function allowValueDrop(event: React.DragEvent<HTMLElement>, columnId: string) {
    const drag = dragRef.current;
    if (!drag || drag.fromColumnId === columnId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    setDropColumnId((current) => (current === columnId ? current : columnId));
  }

  function dropValue(event: React.DragEvent<HTMLElement>, columnId: string) {
    event.preventDefault();
    const drag = dragRef.current;
    endValueDrag();
    if (!drag || drag.fromColumnId === columnId) return;
    commit(moveBoardValue(columns, groupBy, drag.value, columnId));
  }

  return (
    <div className="detail-fields-editor">
      <div className="detail-fields-header">
        <div>
          <h3>Board columns</h3>
          <p>
            Name the columns on the Board, then drag {groupByLabel.toLowerCase()}{" "}
            values into them. Every value starts in {UNASSIGNED_BOARD_COLUMN_NAME}.
            Changing the group-by field clears those mappings and keeps the
            column names.
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
        </div>
      </div>

      {message && <p className="detail-fields-message">{message}</p>}

      <label className="board-group-by">
        Group board by
        <select
          aria-label="Group board by"
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

      <div className="board-mapper" role="list" aria-label="Board columns">
        <MapperColumn
          id={UNASSIGNED_BOARD_COLUMN_ID}
          title={UNASSIGNED_BOARD_COLUMN_NAME}
          note="Unmapped values"
          count={unassigned.length}
          isDropTarget={dropColumnId === UNASSIGNED_BOARD_COLUMN_ID}
          onDragOver={(event) => allowValueDrop(event, UNASSIGNED_BOARD_COLUMN_ID)}
          onDrop={(event) => dropValue(event, UNASSIGNED_BOARD_COLUMN_ID)}
        >
          {unassigned.length === 0 ? (
            <p className="board-mapper-empty">
              {fieldValues.length === 0
                ? "No values for this field yet. Load fields from the product."
                : "Drop values here."}
            </p>
          ) : (
            unassigned.map((value) => (
              <ValueChip
                key={boardValueIdentity(groupBy, value)}
                value={value}
                hidden={isHiddenClosedValue(groupBy, value, showClosedBugs)}
                dragging={draggingValue === value}
                onDragStart={(event) =>
                  beginValueDrag(event, value, UNASSIGNED_BOARD_COLUMN_ID)
                }
                onDragEnd={endValueDrag}
              />
            ))
          )}
        </MapperColumn>

        {columns.map((column, index) => (
          <MapperColumn
            key={column.id}
            id={column.id}
            title={column.name}
            count={column.values.length}
            isDropTarget={dropColumnId === column.id}
            editing={editingId === column.id}
            editingName={editingName}
            onEditingNameChange={setEditingName}
            onCommitRename={() => commitRename(column.id)}
            onCancelRename={() => {
              renameLock.current = true;
              setEditingId(null);
            }}
            onStartRename={() => {
              renameLock.current = false;
              setEditingId(column.id);
              setEditingName(column.name);
              setMessage("");
            }}
            canMoveLeft={index > 0}
            canMoveRight={index < columns.length - 1}
            onMoveLeft={() => commit(moveBoardColumn(columns, column.id, -1))}
            onMoveRight={() => commit(moveBoardColumn(columns, column.id, 1))}
            onDelete={() => {
              setEditingId((current) => (current === column.id ? null : current));
              commit(columns.filter((entry) => entry.id !== column.id));
            }}
            onDragOver={(event) => allowValueDrop(event, column.id)}
            onDrop={(event) => dropValue(event, column.id)}
          >
            {column.values.length === 0 ? (
              <p className="board-mapper-empty">Drop values here.</p>
            ) : (
              column.values.map((value) => (
                <ValueChip
                  key={boardValueIdentity(groupBy, value)}
                  value={value}
                  hidden={isHiddenClosedValue(groupBy, value, showClosedBugs)}
                  dragging={draggingValue === value}
                  onDragStart={(event) => beginValueDrag(event, value, column.id)}
                  onDragEnd={endValueDrag}
                />
              ))
            )}
          </MapperColumn>
        ))}

        <div className="board-mapper-add" data-add-column="">
          {adding ? (
            <>
              <input
                aria-label="New column name"
                placeholder="Column name"
                value={draftName}
                autoFocus
                maxLength={MAX_COLUMN_NAME_LENGTH}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitAdd();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    addLock.current = true;
                    setAdding(false);
                    setDraftName("");
                  }
                }}
                onBlur={(event) => {
                  const next = event.relatedTarget;
                  if (
                    next instanceof HTMLElement &&
                    next.closest("[data-add-column]")
                  ) {
                    return;
                  }
                  if (!draftName.trim()) {
                    setAdding(false);
                    return;
                  }
                  commitAdd();
                }}
              />
              <div className="board-mapper-add-actions">
                <button type="button" className="secondary-button" onClick={commitAdd}>
                  Add
                </button>
                <button
                  type="button"
                  className="text-button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setAdding(false);
                    setDraftName("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="board-mapper-add-button"
              onClick={() => {
                addLock.current = false;
                setAdding(true);
                setDraftName("");
                setMessage("");
              }}
            >
              <Plus size={16} />
              Add column
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function isHiddenClosedValue(
  groupBy: string,
  value: string,
  showClosedBugs: boolean,
): boolean {
  return (
    !showClosedBugs &&
    groupBy === DEFAULT_BOARD_GROUP_BY &&
    boardValueIdentity(groupBy, value) === "CLOSED"
  );
}

function MapperColumn({
  id,
  title,
  note,
  count,
  isDropTarget,
  editing,
  editingName,
  onEditingNameChange,
  onCommitRename,
  onCancelRename,
  onStartRename,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onDragOver,
  onDrop,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  count: number;
  isDropTarget: boolean;
  editing?: boolean;
  editingName?: string;
  onEditingNameChange?: (name: string) => void;
  onCommitRename?: () => void;
  onCancelRename?: () => void;
  onStartRename?: () => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onDelete?: () => void;
  onDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onDrop: (event: React.DragEvent<HTMLElement>) => void;
  children: React.ReactNode;
}) {
  const unassigned = id === UNASSIGNED_BOARD_COLUMN_ID;
  return (
    <section
      role="listitem"
      className={[
        "board-mapper-column",
        unassigned ? "is-unassigned" : "",
        isDropTarget ? "is-drop-target" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-column-id={id}
      aria-label={title}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <header className="board-mapper-column-header">
        {editing && onCommitRename && onEditingNameChange ? (
          <input
            aria-label={`Rename ${title}`}
            value={editingName ?? ""}
            autoFocus
            maxLength={MAX_COLUMN_NAME_LENGTH}
            onChange={(event) => onEditingNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommitRename();
              } else if (event.key === "Escape") {
                event.preventDefault();
                onCancelRename?.();
              }
            }}
            onBlur={onCommitRename}
          />
        ) : (
          <h4>
            {onStartRename ? (
              <button
                type="button"
                className="board-mapper-title"
                title={`Rename ${title}`}
                onClick={onStartRename}
              >
                {title}
              </button>
            ) : (
              title
            )}
            {note && <small>{note}</small>}
          </h4>
        )}
        <span className="board-mapper-count">{count}</span>
        {!unassigned && onMoveLeft && onMoveRight && onDelete && (
          <span className="board-mapper-column-actions">
            <button
              type="button"
              className="board-mapper-icon"
              aria-label={`Move ${title} left`}
              disabled={!canMoveLeft}
              onClick={onMoveLeft}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              className="board-mapper-icon"
              aria-label={`Move ${title} right`}
              disabled={!canMoveRight}
              onClick={onMoveRight}
            >
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              className="board-mapper-icon danger"
              aria-label={`Delete ${title}`}
              onClick={onDelete}
            >
              <Trash2 size={14} />
            </button>
          </span>
        )}
      </header>
      <div className="board-mapper-values">{children}</div>
    </section>
  );
}

function ValueChip({
  value,
  hidden,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  value: string;
  hidden: boolean;
  dragging: boolean;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  const label = value.replaceAll("_", " ");
  return (
    <div
      className={[
        "board-mapper-chip",
        hidden ? "is-hidden" : "",
        dragging ? "is-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-value={value}
      draggable
      role="button"
      tabIndex={0}
      aria-grabbed={dragging}
      title={`Drag ${label} to a column`}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <GripVertical size={14} aria-hidden="true" />
      <span>
        {label}
        {hidden && (
          <small>Hidden on the board until Show closed bugs is on</small>
        )}
      </span>
    </div>
  );
}
