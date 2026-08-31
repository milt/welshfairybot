import { describe, expect, it } from "vitest";
import sentences from "../data/welshFairyBook.json" with { type: "json" };
import getPostText from "../lib/getPostText.js";

describe("getPostText", () => {
  it("returns a non-empty sentence from the Welsh Fairy Book", async () => {
    const text = await getPostText();

    expect(text.trim()).not.toBe("");
    expect(sentences).toContain(text);
  });
});
