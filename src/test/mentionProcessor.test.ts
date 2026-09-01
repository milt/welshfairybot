import { describe, expect, it, vi } from "vitest";
import type { AppBskyFeedPost } from "@atproto/api";
import { processMentions, type MentionBotClient, type MentionStateStore } from "../lib/mentionProcessor.js";
import { serializeMentionState, type MentionBotState } from "../lib/mentionState.js";

const botDid = "did:plc:bot";
const fallback = "No match 🧚";

function notification(index: number, indexedAt = `2026-09-01T12:${String(index).padStart(2, "0")}:00.000Z`) {
  const text = "@bot.example";
  return {
    uri: `at://did:plc:user/app.bsky.feed.post/${index}`,
    cid: `source-${index}`,
    reason: "mention",
    author: { did: "did:plc:user" },
    indexedAt,
    record: {
      text,
      facets: [{
        index: { byteStart: 0, byteEnd: text.length },
        features: [{ $type: "app.bsky.richtext.facet#mention", did: botDid }],
      }],
    },
  };
}

function thread(uri: string, cid: string, replies: unknown[] = []) {
  return { post: { uri, cid, author: { did: "did:plc:user" }, record: { text: "@bot.example" } }, replies };
}

function stateValue(state: MentionBotState): string {
  return serializeMentionState(state).serialized;
}

class MemoryStore implements MentionStateStore {
  value: string | undefined;
  readonly writes: string[] = [];
  writeFailure?: Error;

  constructor(value: string | undefined) {
    this.value = value;
  }

  async read(): Promise<string | undefined> { return this.value; }
  async write(value: string): Promise<void> {
    if (this.writeFailure) throw this.writeFailure;
    this.writes.push(value);
    this.value = value;
  }
}

class FakeBot implements MentionBotClient {
  readonly did = botDid;
  readonly posts: { text: string; reply?: AppBskyFeedPost.ReplyRef }[] = [];
  readonly getThread = vi.fn<(uri: string, depth: number) => Promise<unknown>>();
  readonly getNotifications = vi.fn<(limit: number) => Promise<readonly unknown[]>>();
  onPost?: () => void;

  listNotifications(limit: number): Promise<readonly unknown[]> { return this.getNotifications(limit); }
  getPostThread(uri: string, depth: number): Promise<unknown> { return this.getThread(uri, depth); }
  async post(text: string, reply?: AppBskyFeedPost.ReplyRef): Promise<{ uri: string; cid: string }> {
    this.onPost?.();
    this.posts.push({ text, reply });
    return { uri: `at://did:plc:bot/app.bsky.feed.post/${this.posts.length}`, cid: `bot-${this.posts.length}` };
  }
}

describe("processMentions", () => {
  it("seeds visible mentions on first run without replying", async () => {
    const store = new MemoryStore(undefined);
    const bot = new FakeBot();
    bot.getNotifications.mockResolvedValue([notification(1)]);

    await processMentions(bot, store, fallback, () => undefined);

    expect(bot.posts).toEqual([]);
    expect(bot.getThread).not.toHaveBeenCalled();
    expect(JSON.parse(store.writes[0])).toMatchObject({ processedMentionUris: [notification(1).uri] });
  });

  it("fails safely when existing state is invalid", async () => {
    const store = new MemoryStore("not-json");
    const bot = new FakeBot();
    bot.getNotifications.mockResolvedValue([notification(1)]);

    await expect(processMentions(bot, store, fallback, () => undefined)).rejects.toThrow("MENTION_BOT_STATE is invalid");
    expect(store.writes).toEqual([]);
    expect(bot.getThread).not.toHaveBeenCalled();
    expect(bot.posts).toEqual([]);
  });

  it("handles the five oldest unprocessed mentions first", async () => {
    const store = new MemoryStore(stateValue({ version: 1, processedMentionUris: [] }));
    const bot = new FakeBot();
    const notifications = [6, 5, 4, 3, 2, 1].map((index) => notification(index));
    bot.getNotifications.mockResolvedValue(notifications);
    bot.getThread.mockImplementation(async (uri) => thread(uri, `cid-${uri.at(-1)}`));

    await processMentions(bot, store, fallback, () => undefined);

    expect(bot.posts).toHaveLength(5);
    expect(bot.getThread.mock.calls.map(([uri]) => uri)).toEqual(notifications.slice(1).reverse().map(({ uri }) => uri));
  });

  it("counts a resumed pending request within the five-request limit", async () => {
    const pending = { uri: notification(99).uri, cid: notification(99).cid, parts: ["pending text"] };
    const store = new MemoryStore(stateValue({ version: 1, processedMentionUris: [], pending }));
    const bot = new FakeBot();
    const notifications = [5, 4, 3, 2, 1].map((index) => notification(index));
    bot.getNotifications.mockResolvedValue(notifications);
    bot.getThread.mockImplementation(async (uri) => thread(uri, uri === pending.uri ? pending.cid : "source"));

    await processMentions(bot, store, fallback, () => undefined);

    expect(bot.posts).toHaveLength(5);
    expect(bot.getThread.mock.calls.map(([uri]) => uri)).toEqual([pending.uri, ...notifications.slice(1).reverse().map(({ uri }) => uri)]);
  });

  it("persists pending state before posting and chains missing reply parts", async () => {
    const source = notification(1);
    const pending = { uri: source.uri, cid: source.cid, parts: ["first", "second"] };
    const store = new MemoryStore(stateValue({ version: 1, processedMentionUris: [], pending }));
    const bot = new FakeBot();
    bot.getNotifications.mockResolvedValue([source]);
    bot.getThread.mockResolvedValue(thread(source.uri, source.cid, [
      { post: { uri: "at://did:plc:bot/app.bsky.feed.post/first", cid: "first-cid", author: { did: botDid }, record: { text: "first" } }, replies: [] },
    ]));

    await processMentions(bot, store, fallback, () => undefined);

    expect(bot.posts).toHaveLength(1);
    expect(bot.posts[0]).toMatchObject({ text: "second", reply: { root: { uri: source.uri, cid: source.cid }, parent: { uri: "at://did:plc:bot/app.bsky.feed.post/first", cid: "first-cid" } } });
    expect(JSON.parse(store.writes.at(-1) ?? "{}")).toMatchObject({ processedMentionUris: [source.uri] });
  });

  it("persists a new pending response before its first post", async () => {
    const source = notification(1);
    const store = new MemoryStore(stateValue({ version: 1, processedMentionUris: [] }));
    const bot = new FakeBot();
    bot.getNotifications.mockResolvedValue([source]);
    bot.getThread.mockResolvedValue(thread(source.uri, source.cid));
    bot.onPost = () => {
      expect(JSON.parse(store.writes.at(-1) ?? "{}")).toMatchObject({
        pending: { uri: source.uri, cid: source.cid, parts: [fallback] },
      });
    };

    await processMentions(bot, store, fallback, () => undefined);

    expect(bot.posts).toHaveLength(1);
  });

  it("recognizes a complete existing pending reply chain without reposting", async () => {
    const source = notification(1);
    const pending = { uri: source.uri, cid: source.cid, parts: ["already posted"] };
    const store = new MemoryStore(stateValue({ version: 1, processedMentionUris: [], pending }));
    const bot = new FakeBot();
    bot.getNotifications.mockResolvedValue([source]);
    bot.getThread.mockResolvedValue(thread(source.uri, source.cid, [
      { post: { uri: "at://did:plc:bot/app.bsky.feed.post/1", cid: "bot-cid", author: { did: botDid }, record: { text: "already posted" } }, replies: [] },
    ]));

    await processMentions(bot, store, fallback, () => undefined);

    expect(bot.posts).toEqual([]);
    expect(JSON.parse(store.writes.at(-1) ?? "{}")).toMatchObject({ processedMentionUris: [source.uri] });
  });

  it("does not post when pending persistence or thread lookup fails", async () => {
    const source = notification(1);
    const store = new MemoryStore(stateValue({ version: 1, processedMentionUris: [] }));
    const bot = new FakeBot();
    bot.getNotifications.mockResolvedValue([source]);
    store.writeFailure = new Error("state unavailable");

    await expect(processMentions(bot, store, fallback, () => undefined)).rejects.toThrow("state unavailable");
    expect(bot.posts).toEqual([]);

    store.writeFailure = undefined;
    bot.getThread.mockRejectedValue(new Error("network unavailable"));
    await expect(processMentions(bot, store, fallback, () => undefined)).rejects.toThrow("network unavailable");
    expect(bot.posts).toEqual([]);
  });
});
