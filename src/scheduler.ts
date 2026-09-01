import { env } from "node:process";
import GitHubActionsVariableState from "./lib/githubActionsVariableState.js";
import { runScheduler } from "./lib/scheduler.js";
import { parseSchedulerConfig } from "./lib/schedulerConfig.js";

const config = parseSchedulerConfig(env);
const state = new GitHubActionsVariableState({
  token: config.SCHEDULER_GITHUB_TOKEN,
  repository: config.GITHUB_REPOSITORY,
  apiUrl: config.GITHUB_API_URL,
});

await runScheduler({
  now: new Date(),
  nextPostAt: await state.read(),
  minIntervalMinutes: config.MIN_POST_INTERVAL_MINUTES,
  maxIntervalMinutes: config.MAX_POST_INTERVAL_MINUTES,
  persistNextPostAt: (nextPostAt) => state.write(nextPostAt),
  post: async () => {
    await import("./index.js");
  },
});
