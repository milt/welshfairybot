import { describe, expect, it } from "vitest";
import splitPostText, {
  MAX_POST_GRAPHEMES,
} from "../lib/splitPostText.js";

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

function graphemeLength(text: string): number {
  return Array.from(graphemeSegmenter.segment(text)).length;
}

describe("splitPostText", () => {
  it("leaves short text unchanged", () => {
    const text = "A short sentence from the book.";

    expect(splitPostText(text)).toEqual([text]);
  });

  it("splits long text at word boundaries in the original order", () => {
    const text = Array.from({ length: 80 }, (_, index) => `word${index}`).join(
      " ",
    );
    const parts = splitPostText(text);

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join(" ")).toBe(text);
    expect(parts.every((part) => graphemeLength(part) <= MAX_POST_GRAPHEMES))
      .toBe(true);
  });

  it("produces three posts when the text needs three", () => {
    const text = Array.from({ length: 100 }, () => "abcdef").join(" ");
    const parts = splitPostText(text);

    expect(parts).toHaveLength(3);
    expect(parts.every((part) => graphemeLength(part) <= MAX_POST_GRAPHEMES))
      .toBe(true);
  });

  it("splits an oversized token at grapheme boundaries", () => {
    const text = "🧚".repeat(MAX_POST_GRAPHEMES + 1);
    const parts = splitPostText(text);

    expect(parts).toHaveLength(2);
    expect(parts.join("")).toBe(text);
    expect(parts.every((part) => graphemeLength(part) <= MAX_POST_GRAPHEMES))
      .toBe(true);
  });
});
