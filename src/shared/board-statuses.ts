import { STATUS_SUGGESTIONS } from "./bug-update.js";
import type { Bug } from "./types.js";

/** Canonical Bugzilla statuses shown as Board columns by default. */
export const DEFAULT_BOARD_STATUSES = [...STATUS_SUGGESTIONS];

/** Status key gated by the product "Show closed bugs" setting. */
export const CLOSED_BOARD_STATUS = "CLOSED";

export function defaultBoardStatuses(): string[] {
  return [...DEFAULT_BOARD_STATUSES];
}

/**
 * Ordered board columns from product settings. Always includes every default
 * status (appended if missing) so empty columns still appear on the board.
 */
export function resolveBoardStatuses(statuses: string[] | undefined): string[] {
  const defaults = defaultBoardStatuses();
  if (!statuses || statuses.length === 0) return defaults;

  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const status of statuses) {
    if (typeof status !== "string") continue;
    const key = status.trim();
    if (!key) continue;
    const identity = key.toUpperCase();
    if (seen.has(identity)) continue;
    seen.add(identity);
    resolved.push(key);
  }

  for (const status of defaults) {
    const identity = status.toUpperCase();
    if (seen.has(identity)) continue;
    seen.add(identity);
    resolved.push(status);
  }

  return resolved.length > 0 ? resolved : defaults;
}

/** Columns to render, omitting CLOSED unless show-closed is enabled. */
export function boardStatusesForDisplay(
  statuses: string[] | undefined,
  showClosedBugs: boolean | undefined,
): string[] {
  const resolved = resolveBoardStatuses(statuses);
  if (showClosedBugs) return resolved;
  return resolved.filter(
    (status) => status.toUpperCase() !== CLOSED_BOARD_STATUS,
  );
}

export interface BoardColumn {
  status: string;
  bugs: Bug[];
}

/**
 * Groups bugs into ordered board columns. Configured statuses always appear
 * (even when empty). Unexpected statuses from bugs are appended at the end.
 * CLOSED bugs/columns are omitted when showClosedBugs is off.
 */
export function groupBugsByBoardStatus(
  bugs: Bug[],
  statuses: string[] | undefined,
  showClosedBugs: boolean | undefined,
): BoardColumn[] {
  const columns = boardStatusesForDisplay(statuses, showClosedBugs);
  const groups = new Map<string, Bug[]>();
  const columnByUpper = new Map<string, string>();

  for (const status of columns) {
    groups.set(status, []);
    columnByUpper.set(status.toUpperCase(), status);
  }

  const extras: string[] = [];
  for (const bug of bugs) {
    const raw = bug.status.trim() || "UNKNOWN";
    const upper = raw.toUpperCase();
    if (!showClosedBugs && upper === CLOSED_BOARD_STATUS) continue;

    const existing = columnByUpper.get(upper);
    if (existing) {
      groups.get(existing)!.push(bug);
      continue;
    }

    groups.set(raw, [bug]);
    columnByUpper.set(upper, raw);
    extras.push(raw);
  }

  return [...columns, ...extras].map((status) => ({
    status,
    bugs: groups.get(status) ?? [],
  }));
}
