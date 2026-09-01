import { describe, expect, it } from "vitest";
import sentences from "../data/welshFairyBook.json" with { type: "json" };
import getPostText, { getPostTextContaining } from "../lib/getPostText.js";

describe("getPostText", () => {
  it("returns a non-empty sentence from the Welsh Fairy Book", async () => {
    const text = await getPostText();

    expect(text.trim()).not.toBe("");
    expect(sentences).toContain(text);
  });

  it("matches a case-insensitive multiword phrase", () => {
    const source = sentences.find((sentence) => sentence.trim().length > 20);
    if (!source) {
      throw new Error("Test fixture contains no sufficiently long sentence.");
    }
    const phrase = source.trim().split(/\s+/u).slice(0, 2).join(" ");

    expect(getPostTextContaining(phrase.toUpperCase(), () => 0)).toBe(source);
  });

  it("returns undefined for an empty or unmatched query", () => {
    expect(getPostTextContaining("   ")).toBeUndefined();
    expect(getPostTextContaining("__not-a-book-phrase__")).toBeUndefined();
  });

  it("can select both boundaries of the matching set", () => {
    const source = sentences.find((sentence) => sentence.trim().length > 20);
    if (!source) {
      throw new Error("Test fixture contains no sufficiently long sentence.");
    }
    const phrase = source.trim().split(/\s+/u)[0];
    const matches = sentences.filter((sentence) =>
      sentence.normalize("NFC").toLocaleLowerCase("en-US").includes(
        phrase.normalize("NFC").toLocaleLowerCase("en-US"),
      )
    );

    expect(getPostTextContaining(phrase, () => 0)).toBe(matches[0]);
    expect(getPostTextContaining(phrase, () => 1 - Number.EPSILON)).toBe(
      matches.at(-1),
    );
  });
});
