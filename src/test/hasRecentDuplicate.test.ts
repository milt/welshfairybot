import { describe, expect, it } from "vitest";
import hasRecentDuplicate from "../lib/hasRecentDuplicate.js";

describe("hasRecentDuplicate", () => {
  it("allows a candidate when the recent feed is empty", () => {
    expect(hasRecentDuplicate(["new sentence"], [])).toBe(false);
  });

  it("rejects a matching single-post candidate", () => {
    expect(hasRecentDuplicate(["same sentence"], ["same sentence"])).toBe(true);
  });

  it("matches a complete thread in newest-first feed order", () => {
    expect(
      hasRecentDuplicate(["first…", "…second…", "…third"], ["…third", "…second…", "first…"]),
    ).toBe(true);
  });

  it("does not match partial, non-consecutive, or differently ordered text", () => {
    expect(hasRecentDuplicate(["first…", "…second"], ["…second", "other", "first…"])).toBe(false);
    expect(hasRecentDuplicate(["first…", "…second"], ["first…", "…second"])).toBe(false);
    expect(hasRecentDuplicate(["first…", "…second"], ["first…", "…second"])).toBe(false);
  });
});
