import { env } from "node:process";
import { z } from "zod";
import type { AtpAgentLoginOpts } from "@atproto/api";

const envSchema = z.object({
  BSKY_HANDLE: z.string().min(1),
  BSKY_PASSWORD: z.string().min(1),
  BSKY_SERVICE: z.string().min(1).default("https://bsky.social"),
  BSKY_HISTORY_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
});

const parsed = envSchema.parse(env);

export const bskyAccount: AtpAgentLoginOpts = {
  identifier: parsed.BSKY_HANDLE,
  password: parsed.BSKY_PASSWORD,
};

export const bskyService = parsed.BSKY_SERVICE;
export const bskyHistoryLimit = parsed.BSKY_HISTORY_LIMIT;
