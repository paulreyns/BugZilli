import type { BugComment } from "./types";

export interface SplitComments {
  comments: BugComment[];
  integrations: BugComment[];
}

/** Separates comments authored by the integration user (matched case-insensitively). */
export function splitIntegrationComments(
  comments: BugComment[],
  integrationUser: string | undefined,
): SplitComments {
  const user = integrationUser?.trim().toLowerCase();
  if (!user) return { comments, integrations: [] };
  const regular: BugComment[] = [];
  const integrations: BugComment[] = [];
  for (const comment of comments) {
    if (comment.creator.trim().toLowerCase() === user) integrations.push(comment);
    else regular.push(comment);
  }
  return { comments: regular, integrations };
}
