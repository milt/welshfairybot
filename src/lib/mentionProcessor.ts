import { createMentionResponsePlan, parseMentionNotification, type MentionRequest } from "./mentions.js";
import {
  createMentionState,
  parseMentionState,
  serializeMentionState,
  type MentionBotState,
  type MentionReference,
} from "./mentionState.js";
import type { AppBskyFeedPost } from "@atproto/api";

export interface MentionBotClient {
  did: string;
  listNotifications(limit: number): Promise<readonly unknown[]>;
  getPostThread(uri: string, depth: number): Promise<unknown>;
  post(text: string, reply?: AppBskyFeedPost.ReplyRef): Promise<{ uri: string; cid: string }>;
}

export interface MentionStateStore {
  read(): Promise<string | undefined>;
  write(value: string): Promise<void>;
}

interface ThreadPost { uri: string; cid: string; authorDid: string; text: string; replies: ThreadPost[] }

function threadPost(value: unknown): ThreadPost | undefined {
  if (typeof value !== "object" || value === null || !("post" in value)) return undefined;
  const post = value.post;
  if (typeof post !== "object" || post === null || !("uri" in post) || !("cid" in post) || !("author" in post) || !("record" in post)) return undefined;
  const author = post.author;
  const record = post.record;
  if (typeof author !== "object" || author === null || !("did" in author) || typeof author.did !== "string" || typeof post.uri !== "string" || typeof post.cid !== "string" || typeof record !== "object" || record === null || !("text" in record) || typeof record.text !== "string") return undefined;
  const replies = "replies" in value && Array.isArray(value.replies) ? value.replies.flatMap((reply) => { const parsed = threadPost(reply); return parsed ? [parsed] : []; }) : [];
  return { uri: post.uri, cid: post.cid, authorDid: author.did, text: record.text, replies };
}

function findThreadPost(value: unknown, uri: string): ThreadPost | undefined {
  const post = threadPost(value);
  if (!post) return undefined;
  if (post.uri === uri) return post;
  return post.replies.map((reply) => findThreadPost(reply, uri)).find((reply): reply is ThreadPost => reply !== undefined);
}

async function persist(store: MentionStateStore, state: MentionBotState): Promise<MentionBotState> {
  const result = serializeMentionState(state);
  await store.write(result.serialized);
  return result.state;
}

export async function processMentions(
  bot: MentionBotClient,
  store: MentionStateStore,
  noMatchMessage: string,
  log: (message: string) => void = console.log,
): Promise<void> {
  const notifications = await bot.listNotifications(100);
  log(`Fetched ${notifications.length} notifications.`);
  const requests = notifications.flatMap((notification) => {
    const request = parseMentionNotification(notification, bot.did);
    return request ? [request] : [];
  });
  const rawState = await store.read();
  if (rawState === undefined) {
    const initialState = createMentionState(requests.map((request) => request.uri));
    await persist(store, initialState);
    log("Initialized mention state; no historical mentions were replied to.");
    return;
  }
  let state = parseMentionState(rawState);
  if (!state) {
    throw new Error("MENTION_BOT_STATE is invalid; delete it to reinitialize mention history.");
  }

  const processRequest = async (request: MentionRequest, currentState: MentionBotState): Promise<MentionBotState> => {
    const plan = createMentionResponsePlan(request.query, noMatchMessage);
    if (plan.usedFallback) log(`No sentence match for mention ${request.uri}; using fallback.`);
    const pending = currentState.pending?.uri === request.uri
      ? currentState.pending
      : { uri: request.uri, cid: request.cid, ...(request.root ? { root: request.root } : {}), parts: plan.parts };
    let next = currentState.pending?.uri === request.uri ? currentState : await persist(store, { ...currentState, pending });
    const thread = await bot.getPostThread(request.uri, pending.parts.length + 2);
    const source = findThreadPost(thread, request.uri);
    if (!source) {
      next = await persist(store, { ...next, pending: undefined, processedMentionUris: [request.uri, ...next.processedMentionUris] });
      log(`Skipped unavailable mention ${request.uri}.`);
      return next;
    }
    let parent: MentionReference = { uri: source.uri, cid: source.cid };
    const root: MentionReference = pending.root ?? parent;
    let threadNode = source;
    for (const part of pending.parts) {
      const existing = threadNode.replies.find((reply) => reply.authorDid === bot.did && reply.text === part);
      if (existing) { parent = { uri: existing.uri, cid: existing.cid }; threadNode = existing; continue; }
      const posted = await bot.post(part, { root: root as AppBskyFeedPost.ReplyRef["root"], parent: parent as AppBskyFeedPost.ReplyRef["parent"] });
      parent = posted;
      threadNode = { uri: posted.uri, cid: posted.cid, authorDid: bot.did, text: part, replies: [] };
    }
    next = await persist(store, { ...next, pending: undefined, processedMentionUris: [request.uri, ...next.processedMentionUris] });
    log(`Replied to mention ${request.uri}${pending.parts.length > 1 ? " (thread)" : ""}.`);
    return next;
  };

  const activeState = state;
  if (activeState.pending) {
    const pendingSource = requests.find((request) => request.uri === activeState.pending?.uri);
    const pendingRequest: MentionRequest = {
      uri: activeState.pending.uri,
      cid: activeState.pending.cid,
      authorDid: "",
      indexedAt: "",
      query: "",
      ...(activeState.pending.root ? { root: activeState.pending.root } : {}),
    };
    state = await processRequest(pendingSource ?? pendingRequest, activeState);
  }
  const latestState = state ?? activeState;
  const candidates = requests
    .filter((request) => !latestState.processedMentionUris.includes(request.uri))
    .sort((a, b) => Date.parse(a.indexedAt) - Date.parse(b.indexedAt))
    .slice(0, activeState.pending ? 4 : 5);
  for (const request of candidates) state = await processRequest(request, state);
}
