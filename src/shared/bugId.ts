const BUG_ID_PATTERN = /^(?:bz-|#)?(\d+)$/i;

export function bugUrl(baseUrl: string, id: number): string {
  return `${baseUrl.replace(/\/+$/, "")}/show_bug.cgi?id=${id}`;
}

export function parseBugId(value: string, baseUrl?: string): number | undefined {
  const match = BUG_ID_PATTERN.exec(value.trim());
  if (match?.[1]) return positiveSafeInteger(match[1]);
  if (!baseUrl) return undefined;

  try {
    const url = new URL(value.trim());
    const expectedUrl = new URL(bugUrl(baseUrl, 1));
    if (
      url.origin !== expectedUrl.origin ||
      url.pathname !== expectedUrl.pathname ||
      url.searchParams.getAll("id").length !== 1
    ) {
      return undefined;
    }
    return positiveSafeInteger(url.searchParams.get("id") ?? "");
  } catch {
    return undefined;
  }
}

function positiveSafeInteger(value: string): number | undefined {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}
