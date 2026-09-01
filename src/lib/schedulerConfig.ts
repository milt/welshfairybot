import { z } from "zod";

const optionalInteger = (defaultValue: number) =>
  z.preprocess(
    (value) => value === "" || value === undefined ? undefined : value,
    z.coerce.number().int().positive().default(defaultValue),
  );

const schedulerConfigSchema = z.object({
  MIN_POST_INTERVAL_MINUTES: optionalInteger(180),
  MAX_POST_INTERVAL_MINUTES: optionalInteger(720),
  SCHEDULER_GITHUB_TOKEN: z.string().min(1),
  GITHUB_REPOSITORY: z.string().regex(/^[^/]+\/[^/]+$/u),
  GITHUB_API_URL: z.string().url().default("https://api.github.com"),
  BSKY_NO_MATCH_MESSAGE: z.preprocess(
    (value) => value === "" || value === undefined ? undefined : value,
    z.string().min(1).default("The Fair Family could not find a matching sentence. 🧚"),
  ),
}).refine(
  (config) =>
    config.MIN_POST_INTERVAL_MINUTES <= config.MAX_POST_INTERVAL_MINUTES,
  {
    message: "Minimum post interval cannot exceed maximum post interval.",
    path: ["MIN_POST_INTERVAL_MINUTES"],
  },
);

export type SchedulerConfig = z.infer<typeof schedulerConfigSchema>;

export function parseSchedulerConfig(input: unknown): SchedulerConfig {
  return schedulerConfigSchema.parse(input);
}
