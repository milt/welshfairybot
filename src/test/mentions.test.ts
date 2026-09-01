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

function mentionFacet(text: string, mention: string, did = botDid) {
  const start = new TextEncoder().encode(text.slice(0, text.indexOf(mention))).length;
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

  it("ignores self-mentions, non-mentions, and malformed records", () => {
    const text = "@welshfairybot.bsky.social Ianto";
    const facet = mentionFacet(text, "@welshfairybot.bsky.social");

    expect(parseMentionNotification({ ...mentionNotification(text, [facet]), reason: "reply" }, botDid)).toBeUndefined();
    expect(parseMentionNotification({ ...mentionNotification(text, [facet]), author: { did: botDid } }, botDid)).toBeUndefined();
    expect(parseMentionNotification({ ...mentionNotification(text, []), record: { text, facets: [] } }, botDid)).toBeUndefined();
    expect(parseMentionNotification({ ...mentionNotification(text, []), record: { text, facets: [{ index: { byteStart: 1, byteEnd: 500 }, features: [{ $type: "app.bsky.richtext.facet#mention", did: botDid }] }] } }, botDid)).toBeUndefined();
    expect(parseMentionNotification({ reason: "mention" }, botDid)).toBeUndefined();
  });
});
