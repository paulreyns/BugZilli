import { describe, expect, it } from "vitest";
import { bugUrl, parseBugId } from "./bugId";

describe("parseBugId", () => {
  it("accepts plain numbers with surrounding whitespace", () => {
    expect(parseBugId("12345")).toBe(12345);
    expect(parseBugId("  42\n")).toBe(42);
  });

  it("accepts the BZ- key format and # prefix", () => {
    expect(parseBugId("BZ-981")).toBe(981);
    expect(parseBugId("bz-7")).toBe(7);
    expect(parseBugId("#300")).toBe(300);
  });

  it("builds a Bugzilla bug URL without a duplicate trailing slash", () => {
    expect(bugUrl("https://bugs.example.com/", 123)).toBe(
      "https://bugs.example.com/show_bug.cgi?id=123",
    );
  });

  it("accepts a bug URL for the configured Bugzilla instance", () => {
    expect(
      parseBugId(
        "https://bugs.example.com/show_bug.cgi?id=123",
        "https://bugs.example.com",
      ),
    ).toBe(123);
    expect(
      parseBugId(
        "https://bugs.example.com/bugzilla/show_bug.cgi?id=456",
        "https://bugs.example.com/bugzilla",
      ),
    ).toBe(456);
  });

  it("rejects Bugzilla URLs from another instance or a different path", () => {
    expect(
      parseBugId(
        "https://other.example.com/show_bug.cgi?id=123",
        "https://bugs.example.com",
      ),
    ).toBeUndefined();
    expect(
      parseBugId(
        "https://bugs.example.com/other/show_bug.cgi?id=123",
        "https://bugs.example.com",
      ),
    ).toBeUndefined();
  });

  it("rejects anything that is not a positive bug id", () => {
    for (const value of ["", "abc", "12a", "1.5", "-3", "0", "1 2", "99999999999999999999"]) {
      expect(parseBugId(value)).toBeUndefined();
    }
  });
});
