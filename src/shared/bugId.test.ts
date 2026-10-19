import { describe, expect, it } from "vitest";
import { parseBugId } from "./bugId";

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

  it("rejects anything that is not a positive bug id", () => {
    for (const value of ["", "abc", "12a", "1.5", "-3", "0", "1 2", "99999999999999999999"]) {
      expect(parseBugId(value)).toBeUndefined();
    }
  });
});
