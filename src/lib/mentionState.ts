export const MENTION_STATE_VERSION = 1 as const;
export const MAX_PROCESSED_MENTIONS = 100;
export const MAX_MENTION_STATE_BYTES = 40 * 1024;

export interface MentionReference {
  uri: string;
  cid: string;
}

export interface PendingMention {
  uri: string;
  cid: string;
  root?: MentionReference;
  parts: string[];
}

export interface MentionBotState {
  version: typeof MENTION_STATE_VERSION;
  processedMentionUris: string[];
  pending?: PendingMention;
}

const isReference = (value: unknown): value is MentionReference =>
  typeof value === "object" && value !== null &&
  "uri" in value && typeof value.uri === "string" &&
  "cid" in value && typeof value.cid === "string";

const isPending = (value: unknown): value is PendingMention =>
  typeof value === "object" && value !== null &&
  "uri" in value && typeof value.uri === "string" &&
  "cid" in value && typeof value.cid === "string" &&
  "parts" in value && Array.isArray(value.parts) &&
  value.parts.length > 0 && value.parts.every((part) => typeof part === "string") &&
  (!("root" in value) || value.root === undefined || isReference(value.root));

export function parseMentionState(serialized: string | undefined): MentionBotState | undefined {
  if (!serialized) return undefined;
  try {
    const value: unknown = JSON.parse(serialized);
    if (typeof value !== "object" || value === null ||
      !("version" in value) || value.version !== MENTION_STATE_VERSION ||
      !("processedMentionUris" in value) || !Array.isArray(value.processedMentionUris) ||
      !value.processedMentionUris.every((uri) => typeof uri === "string") ||
      (("pending" in value) && (value as { pending?: unknown }).pending !== undefined && !isPending((value as { pending?: unknown }).pending))) {
      return undefined;
    }
    return {
      version: MENTION_STATE_VERSION,
      processedMentionUris: [...new Set(value.processedMentionUris)].slice(0, MAX_PROCESSED_MENTIONS),
      ...((value as { pending?: unknown }).pending !== undefined && isPending((value as { pending?: unknown }).pending) ? { pending: (value as unknown as { pending: PendingMention }).pending } : {}),
    };
  } catch {
    return undefined;
  }
}

export function createMentionState(processedMentionUris: string[] = []): MentionBotState {
  return { version: MENTION_STATE_VERSION, processedMentionUris: [...new Set(processedMentionUris)].slice(0, MAX_PROCESSED_MENTIONS) };
}

export function serializeMentionState(input: MentionBotState): { serialized: string; state: MentionBotState; prunedCount: number } {
  const state: MentionBotState = {
    version: MENTION_STATE_VERSION,
    processedMentionUris: [...new Set(input.processedMentionUris)].slice(0, MAX_PROCESSED_MENTIONS),
    ...(input.pending === undefined ? {} : { pending: input.pending }),
  };
  let serialized = JSON.stringify(state);
  let prunedCount = 0;
  while (Buffer.byteLength(serialized, "utf8") > MAX_MENTION_STATE_BYTES && state.processedMentionUris.length > 0) {
    state.processedMentionUris.pop();
    prunedCount += 1;
    serialized = JSON.stringify(state);
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_MENTION_STATE_BYTES) {
    throw new Error("Mention bot state exceeds the 40 KB limit.");
  }
  return { serialized, state, prunedCount };
}
