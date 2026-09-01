import { env } from "node:process";
import GitHubActionsVariableState from "./lib/githubActionsVariableState.js";
import { runScheduler } from "./lib/scheduler.js";
import { parseSchedulerConfig } from "./lib/schedulerConfig.js";
import Bot from "./lib/bot.js";
import { bskyAccount, bskyService } from "./lib/config.js";
import { processMentions } from "./lib/mentionProcessor.js";

const config = parseSchedulerConfig(env);
const state = new GitHubActionsVariableState({
  variableName: "NEXT_POST_AT",
  token: config.SCHEDULER_GITHUB_TOKEN,
  repository: config.GITHUB_REPOSITORY,
  apiUrl: config.GITHUB_API_URL,
});
const mentionState = new GitHubActionsVariableState({
  variableName: "MENTION_BOT_STATE",
  token: config.SCHEDULER_GITHUB_TOKEN,
  repository: config.GITHUB_REPOSITORY,
  apiUrl: config.GITHUB_API_URL,
});
const mentionBot = new Bot(bskyService);
await mentionBot.login(bskyAccount);
await processMentions(mentionBot, mentionState, config.BSKY_NO_MATCH_MESSAGE);

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
