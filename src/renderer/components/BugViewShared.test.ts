import { describe, expect, it } from "vitest";
import { userAvatarStyle } from "./BugViewShared";

describe("userAvatarStyle", () => {
  it("assigns the same color to the same identity regardless of case or whitespace", () => {
    expect(userAvatarStyle("  Alice.Example  ")).toEqual(
      userAvatarStyle("alice.example"),
    );
  });

  it("assigns different colors to different identities", () => {
    expect(userAvatarStyle("alice@example.com")).not.toEqual(
      userAvatarStyle("bob@example.com"),
    );
  });

  it("leaves avatars without an identity to their default style", () => {
    expect(userAvatarStyle("  ")).toBeUndefined();
  });
});
