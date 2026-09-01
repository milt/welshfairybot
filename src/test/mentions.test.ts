import { describe, expect, it } from "vitest";
import { parseMentionNotification } from "../lib/mentions.js";

const botDid = "did:plc:bot";

function mentionNotification(text: string, facets: unknown[]) {
  return {
    uri: "at://did:plc:user/app.bsky.feed.post/1",
    cid: "bafytest",
    reason: "mention",
    author: { did: "did:plc:user" },
    indexedAt: "2026-09-01T12:00:00.000Z",
    record: { text, facets },
  };
}

function mentionFacet(text: string, mention: string, did = botDid, occurrence = 0) {
  let characterIndex = -1;
  for (let index = 0; index <= occurrence; index += 1) {
    characterIndex = text.indexOf(mention, characterIndex + 1);
  }
  const start = new TextEncoder().encode(text.slice(0, characterIndex)).length;
  const end = start + new TextEncoder().encode(mention).length;
  return {
    index: { byteStart: start, byteEnd: end },
    features: [{ $type: "app.bsky.richtext.facet#mention", did }],
  };
}

describe("parseMentionNotification", () => {
  it("removes the bot mention and returns the remaining query", () => {
    const text = "@welshfairybot.bsky.social Ianto";
    const notification = mentionNotification(text, [mentionFacet(text, "@welshfairybot.bsky.social")]);

    expect(parseMentionNotification(notification, botDid)).toMatchObject({
      query: "Ianto",
      authorDid: "did:plc:user",
    });
  });

  it("handles Unicode text before the bot mention using byte offsets", () => {
    const text = "✨ @welshfairybot.bsky.social Ianto";
    const notification = mentionNotification(text, [mentionFacet(text, "@welshfairybot.bsky.social")]);

    expect(parseMentionNotification(notification, botDid)?.query).toBe("✨ Ianto");
  });

  it("removes every bot mention while preserving Unicode and unrelated mentions", () => {
    const text = "✨ @bot.example Ianto @other.example @bot.example";
    const notification = mentionNotification(text, [
      mentionFacet(text, "@bot.example", botDid, 0),
      mentionFacet(text, "@other.example", "did:plc:other"),
      mentionFacet(text, "@bot.example", botDid, 1),
    ]);

    expect(parseMentionNotification(notification, botDid)?.query).toBe("✨ Ianto @other.example");
  });

  it("ignores self-mentions, non-mentions, and malformed records", () => {
    const text = "@welshfairybot.bsky.social Ianto";
    const facet = mentionFacet(text, "@welshfairybot.bsky.social");

    expect(parseMentionNotification({ ...mentionNotification(text, [facet]), reason: "reply" }, botDid)).toBeUndefined();
    expect(parseMentionNotification({ ...mentionNotification(text, [facet]), author: { did: botDid } }, botDid)).toBeUndefined();
    expect(parseMentionNotification({ ...mentionNotification(text, []), record: { text, facets: [] } }, botDid)).toBeUndefined();
    expect(parseMentionNotification({ ...mentionNotification(text, []), record: { text, facets: [{ index: { byteStart: 1, byteEnd: 500 }, features: [{ $type: "app.bsky.richtext.facet#mention", did: botDid }] }] } }, botDid)).toBeUndefined();
    expect(parseMentionNotification({ ...mentionNotification("✨ @bot.example", []), record: { text: "✨ @bot.example", facets: [{ index: { byteStart: 1, byteEnd: 2 }, features: [{ $type: "app.bsky.richtext.facet#mention", did: botDid }] }] } }, botDid)).toBeUndefined();
    expect(parseMentionNotification(mentionNotification(text, [
      { index: { byteStart: 0, byteEnd: 10 }, features: [{ $type: "app.bsky.richtext.facet#mention", did: botDid }] },
      { index: { byteStart: 5, byteEnd: 15 }, features: [{ $type: "app.bsky.richtext.facet#mention", did: botDid }] },
    ]), botDid)).toBeUndefined();
    expect(parseMentionNotification({ reason: "mention" }, botDid)).toBeUndefined();
  });

  it("uses the shared fallback and splits long fallback replies", () => {
    expect(createMentionResponsePlan("__no_match__").parts).toEqual([DEFAULT_NO_MATCH_MESSAGE]);

    const plan = createMentionResponsePlan("__no_match__", "x ".repeat(250));
    expect(plan.usedFallback).toBe(true);
    expect(plan.parts.length).toBeGreaterThan(1);
    expect(plan.parts.every((part) => Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(part)).length <= 300)).toBe(true);
  });
});
