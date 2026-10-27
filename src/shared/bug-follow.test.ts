import { describe, expect, it } from "vitest";
import { followerDisplayName, isFollowingBug } from "./bug-follow";
import type { BugFollower, BugzillaUser } from "./types";

const user: BugzillaUser = { id: 1, name: "me@example.com", realName: "Me" };

describe("isFollowingBug", () => {
  it("returns false without a current user", () => {
    expect(isFollowingBug([{ name: "me@example.com" }], undefined)).toBe(false);
  });

  it("matches login names case-insensitively", () => {
    const followers: BugFollower[] = [{ name: "Me@Example.com" }];
    expect(isFollowingBug(followers, user)).toBe(true);
  });

  it("matches against follower email when login differs", () => {
    const followers: BugFollower[] = [
      { name: "me", email: "me@example.com", realName: "Me" },
    ];
    expect(isFollowingBug(followers, user)).toBe(true);
  });

  it("returns false when the user is not on the CC list", () => {
    expect(
      isFollowingBug([{ name: "other@example.com" }], user),
    ).toBe(false);
  });
});

describe("followerDisplayName", () => {
  it("prefers real name", () => {
    expect(
      followerDisplayName({
        name: "dev@example.com",
        realName: "Dev Name",
      }),
    ).toBe("Dev Name");
  });

  it("falls back to login name", () => {
    expect(followerDisplayName({ name: "dev@example.com" })).toBe(
      "dev@example.com",
    );
  });
});
