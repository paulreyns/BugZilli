import type { BugFollower, BugzillaUser } from "./types";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** True when `user` appears on the bug CC list (by login or email). */
export function isFollowingBug(
  followers: BugFollower[],
  user: BugzillaUser | undefined,
): boolean {
  if (!user) return false;
  return followers.some((follower) => {
    
    if (user.id > 0 && follower.id !== undefined && user.id === follower.id) {
      return true;
    }

    const userNames = [user.name, user.email, user.nick, user.realName]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(normalize);
    const followerNames = [follower.name, follower.email, follower.realName]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(normalize);
    return userNames.some((userName) => followerNames.includes(userName));
  });
}

/** Preferred label for a follower in the follow menu. */
export function followerDisplayName(follower: BugFollower): string {
  const realName = follower.realName?.trim();
  if (realName) return realName;
  return follower.name.trim() || follower.email?.trim() || "Unknown";
}
