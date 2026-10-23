import { History } from "lucide-react";
import {
  detailFieldDefinition,
  keyForBugzillaField,
} from "../../../shared/detail-fields";
import type { BugHistoryEntry } from "../../../shared/types";
import { formatDetailDate } from "../../utils/date";
import { TabEmpty } from "./TabEmpty";

export function HistoryTab({
  hidden,
  history,
}: {
  hidden: boolean;
  history: BugHistoryEntry[];
}) {
  return (
    <div className="history" role="tabpanel" hidden={hidden}>
      {history.length === 0 ? (
        <TabEmpty icon={<History size={28} />} text="No history." />
      ) : (
        history.map((entry, index) => {
          const who = entry.whoName || entry.who;
          return (
            <article
              className="history-entry"
              key={`${entry.when}-${entry.who}-${index}`}
            >
              <span className="comment-avatar">
                {who.slice(0, 1).toUpperCase() || "?"}
              </span>
              <div>
                <header>
                  <strong>{who || "Unknown"}</strong>
                  <time>{formatDetailDate(entry.when)}</time>
                </header>
                <ul className="history-changes">
                  {entry.changes.map((change, changeIndex) => (
                    <li key={`${change.fieldName}-${changeIndex}`}>
                      <span className="history-field">
                        {historyFieldLabel(change.fieldName)}
                        {change.attachmentId
                          ? ` (attachment ${change.attachmentId})`
                          : ""}
                      </span>
                      <span className="history-values">
                        <HistoryValue value={change.removed} empty="—" />
                        <span aria-hidden="true">→</span>
                        <HistoryValue value={change.added} empty="—" />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}

function historyFieldLabel(fieldName: string): string {
  const trimmed = fieldName.trim();
  if (!trimmed) return "Field";
  return detailFieldDefinition(keyForBugzillaField(trimmed)).label;
}

function HistoryValue({ value, empty }: { value: string; empty: string }) {
  const trimmed = value.trim();
  return (
    <code className={trimmed ? undefined : "history-empty"}>
      {trimmed || empty}
    </code>
  );
}
