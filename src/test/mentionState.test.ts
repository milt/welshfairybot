import { describe, expect, it } from "vitest";
import {
  createMentionState,
  MAX_MENTION_STATE_BYTES,
  parseMentionState,
  serializeMentionState,
} from "../lib/mentionState.js";

describe("mention state", () => {
  it("round-trips versioned state and caps processed URIs", () => {
    const state = createMentionState(Array.from({ length: 120 }, (_, i) => `at://mention/${i}`));
    expect(state.processedMentionUris).toHaveLength(100);
    expect(parseMentionState(JSON.stringify(state))).toEqual(state);
  });

  it("prunes oldest URIs to stay within the UTF-8 ceiling", () => {
    const result = serializeMentionState({
      version: 1,
      processedMentionUris: Array.from({ length: 100 }, (_, i) => `at://${"x".repeat(500)}-${i}`),
    });
    expect(Buffer.byteLength(result.serialized, "utf8")).toBeLessThanOrEqual(MAX_MENTION_STATE_BYTES);
    expect(result.prunedCount).toBeGreaterThan(0);
  });

  it("rejects a pending payload that cannot fit", () => {
    expect(() => serializeMentionState({
      version: 1,
      processedMentionUris: [],
      pending: { uri: "at://source", cid: "cid", parts: ["x".repeat(MAX_MENTION_STATE_BYTES)] },
    })).toThrow("40 KB");
  });
});
