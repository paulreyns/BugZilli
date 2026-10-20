import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import {
  CLOSED_BOARD_STATUS,
  defaultBoardStatuses,
  resolveBoardStatuses,
} from "../../shared/board-statuses";

interface BoardStatusesEditorProps {
  boardStatuses: string[] | undefined;
  showClosedBugs: boolean;
  onChange: (statuses: string[]) => void;
}

export function BoardStatusesEditor({
  boardStatuses,
  showClosedBugs,
  onChange,
}: BoardStatusesEditorProps) {
  const selected = resolveBoardStatuses(boardStatuses);

  function move(status: string, direction: -1 | 1) {
    const index = selected.indexOf(status);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= selected.length) return;
    const next = [...selected];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(next);
  }

  return (
    <div className="detail-fields-editor">
      <div className="detail-fields-header">
        <div>
          <h3>Board column order</h3>
          <p>
            Choose the order of status columns on the Board. Every status is
            shown even when it has no issues.
          </p>
        </div>
        <div className="detail-fields-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => onChange(defaultBoardStatuses())}
          >
            <RotateCcw size={14} /> Reset to default
          </button>
        </div>
      </div>

      <div className="detail-fields-layout board-statuses-layout">
        <div className="detail-fields-order">
          <h4>Display order</h4>
          <ol>
            {selected.map((status, index) => {
              const isClosed = status.toUpperCase() === CLOSED_BOARD_STATUS;
              const hiddenOnBoard = isClosed && !showClosedBugs;
              return (
                <li key={status} className={hiddenOnBoard ? "board-status-hidden" : undefined}>
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
        </div>
      </div>
    </div>
  );
}
