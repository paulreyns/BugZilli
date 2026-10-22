export function formatDetailDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatListDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function toDateInputValue(value: string): string {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

export function toDateTimeLocalValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  const match = normalized.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2})?/,
  );
  if (!match) return "";
  return `${match[1]}T${match[2]}`;
}

export function fromDateTimeLocalValue(value: string): string {
  if (!value) return "";
  return value.length === 16 ? `${value}:00` : value;
}
