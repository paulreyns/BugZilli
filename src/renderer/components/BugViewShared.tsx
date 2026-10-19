import { LayoutList } from "lucide-react";

export function initials(value: string): string {
  const name = value.split("@")[0] ?? value;
  return name
    .split(/[._\s-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (/(resolved|closed|verified)/.test(normalized)) return "status-done";
  if (/(progress|assigned|reopened)/.test(normalized)) return "status-progress";
  return "status-todo";
}

export function EmptyState() {
  return (
    <div className="empty-state">
      <LayoutList size={36} />
      <h2>No issues found</h2>
      <p>Try changing your search or check the project product name.</p>
    </div>
  );
}
