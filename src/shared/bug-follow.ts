import type { BugFollower, BugzillaUser } from "./types";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** True when `user` appears on the bug CC list (by login or email). */
export function isFollowingBug(
  followers: BugFollower[],
  user: BugzillaUser | undefined,
): boolean {
  if (!user?.name.trim()) return false;
  const login = normalize(user.name);
  return followers.some((follower) => {
    const names = [follower.name, follower.email].filter(Boolean) as string[];
    return names.some((name) => normalize(name) === login);
  });
}

/** Preferred label for a follower in the follow menu. */
export function followerDisplayName(follower: BugFollower): string {
  const realName = follower.realName?.trim();
  if (realName) return realName;
  return follower.name.trim() || follower.email?.trim() || "Unknown";
}
