import { getPostTextContaining } from "./getPostText.js";
import splitPostText from "./splitPostText.js";

export const DEFAULT_NO_MATCH_MESSAGE =
  "The fair family could not find a matching sentence. 🧚";

interface StrongReference {
  uri: string;
  cid: string;
}

export interface MentionRequest {
  uri: string;
  cid: string;
  authorDid: string;
  indexedAt: string;
  query: string;
  root?: StrongReference;
}

export interface MentionResponsePlan {
  query: string;
  matchedText?: string;
  parts: string[];
  usedFallback: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStrongReference(value: unknown): value is StrongReference {
  return (
    isObject(value) &&
    isString(value.uri) &&
    isString(value.cid)
  );
}

function mentionTargetsBot(
  feature: unknown,
  botDid: string,
): boolean {
  return (
    isObject(feature) &&
    feature.$type === "app.bsky.richtext.facet#mention" &&
    feature.did === botDid
  );
}

function removeBotMention(
  text: string,
  facets: unknown[],
  botDid: string,
): string | undefined {
  const ranges: { start: number; end: number }[] = [];
  for (const facet of facets) {
    if (!isObject(facet) || !isObject(facet.index)) {
      continue;
    }
    const features = Array.isArray(facet.features) ? facet.features : [];
    if (!features.some((feature) => mentionTargetsBot(feature, botDid))) {
      continue;
    }
    const start = facet.index.byteStart;
    const end = facet.index.byteEnd;
    if (
      typeof start !== "number" || typeof end !== "number" ||
      !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start
    ) {
      return undefined;
    }
    ranges.push({ start, end });
  }

  const bytes = new TextEncoder().encode(text);
  const ascendingRanges = [...ranges].sort((a, b) => a.start - b.start);
  if (
    ascendingRanges.some(({ start, end }, index) =>
      end > bytes.length ||
      (index > 0 && start < ascendingRanges[index - 1].end)
    )
  ) {
    return undefined;
  }

  const removedByteLength = ascendingRanges.reduce(
    (length, { start, end }) => length + end - start,
    0,
  );
  const withoutMentions = new Uint8Array(bytes.length - removedByteLength);
  let sourceOffset = 0;
  let outputOffset = 0;
  for (const { start, end } of ascendingRanges) {
    const chunk = bytes.slice(sourceOffset, start);
    withoutMentions.set(chunk, outputOffset);
    outputOffset += chunk.length;
    sourceOffset = end;
  }
  withoutMentions.set(bytes.slice(sourceOffset), outputOffset);
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(withoutMentions);
  } catch {
    return undefined;
  }
  return text.replace(/\s+/gu, " ").trim();
}

export function parseMentionNotification(
  notification: unknown,
  botDid: string,
): MentionRequest | undefined {
  if (!isObject(notification) || notification.reason !== "mention") {
    return undefined;
  }
  if (
    !isString(notification.uri) ||
    !isString(notification.cid) ||
    !isString(notification.indexedAt) ||
    !isObject(notification.author) ||
    !isString(notification.author.did) ||
    notification.author.did === botDid ||
    !isObject(notification.record) ||
    !isString(notification.record.text) ||
    !Array.isArray(notification.record.facets)
  ) {
    return undefined;
  }

  const hasBotMention = notification.record.facets.some((facet) =>
    isObject(facet) &&
    Array.isArray(facet.features) &&
    facet.features.some((feature) => mentionTargetsBot(feature, botDid))
  );
  if (!hasBotMention) {
    return undefined;
  }

  const query = removeBotMention(
    notification.record.text,
    notification.record.facets,
    botDid,
  );
  if (query === undefined) {
    return undefined;
  }
  const reply = notification.record.reply;
  const root = isObject(reply) && isStrongReference(reply.root)
    ? reply.root
    : undefined;

  return {
    uri: notification.uri,
    cid: notification.cid,
    authorDid: notification.author.did,
    indexedAt: notification.indexedAt,
    query,
    root,
  };
}

export function createMentionResponsePlan(
  query: string,
  noMatchMessage = DEFAULT_NO_MATCH_MESSAGE,
  randomSource: () => number = Math.random,
): MentionResponsePlan {
  const normalizedQuery = query.normalize("NFC").trim();
  const matchedText = normalizedQuery.length > 0
    ? getPostTextContaining(normalizedQuery, randomSource)
    : undefined;
  const response = matchedText ??
    (noMatchMessage.trim() || DEFAULT_NO_MATCH_MESSAGE);

  return {
    query: normalizedQuery,
    matchedText,
    parts: splitPostText(response),
    usedFallback: matchedText === undefined,
  };
}
