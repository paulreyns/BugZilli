const BUG_ID_PATTERN = /^(?:bz-|#)?(\d+)$/i;

export function parseBugId(value: string): number | undefined {
  const match = BUG_ID_PATTERN.exec(value.trim());
  if (!match?.[1]) return undefined;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}
