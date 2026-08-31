import { bskyAccount, bskyHistoryLimit, bskyService } from "./config.js";
import type {
  AppBskyFeedPost,
  AtpAgentLoginOpts,
  AtpAgentOptions,
} from "@atproto/api";
import { AtpAgent, RichText } from "@atproto/api";
import splitPostText from "./splitPostText.js";
import hasRecentDuplicate from "./hasRecentDuplicate.js";

interface BotOptions {
  service: string | URL;
  dryRun: boolean;
  historyLimit: number;
}

export default class Bot {
  #agent;

  static defaultOptions: BotOptions = {
    service: bskyService,
    dryRun: false,
    historyLimit: bskyHistoryLimit,
  } as const;

  constructor(service: AtpAgentOptions["service"]) {
    this.#agent = new AtpAgent({ service });
  }

  login(loginOpts: AtpAgentLoginOpts) {
    return this.#agent.login(loginOpts);
  }

  async recentPostTexts(limit: number): Promise<string[]> {
    const actor = this.#agent.did;
    if (!actor) {
      throw new Error("Bot must be logged in before fetching recent posts.");
    }
    const response = await this.#agent.getAuthorFeed({
      actor,
      limit,
    });
    return response.data.feed.flatMap(({ post }) => {
      const record = post.record;
      if (
        typeof record === "object" &&
        record !== null &&
        "text" in record &&
        typeof record.text === "string"
      ) {
        return [record.text];
      }
      return [];
    });
  }

  async post(
    text:
      | string
      | (
        & Partial<AppBskyFeedPost.Record>
        & Omit<AppBskyFeedPost.Record, "createdAt">
      ),
    reply?: AppBskyFeedPost.ReplyRef,
  ) {
    if (typeof text === "string") {
      const richText = new RichText({ text });
      await richText.detectFacets(this.#agent);
      const record = {
        text: richText.text,
        facets: richText.facets,
        reply,
      };
      return this.#agent.post(record);
    } else {
      return this.#agent.post(text);
    }
  }

  static async run(
    getPostText: () => Promise<string>,
    botOptions?: Partial<BotOptions>,
  ) {
    const { service, dryRun, historyLimit } = botOptions
      ? Object.assign({}, this.defaultOptions, botOptions)
      : this.defaultOptions;
    const bot = new Bot(service);
    await bot.login(bskyAccount);
    let text = "";
    let parts: string[] = [];
    const recentPostTexts = dryRun
      ? []
      : await bot.recentPostTexts(historyLimit);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      text = (await getPostText()).trim();
      parts = splitPostText(text);
      if (!hasRecentDuplicate(parts, recentPostTexts)) {
        break;
      }
      if (attempt === 9) {
        throw new Error("Could not select a sentence not recently posted.");
      }
    }
    if (!dryRun) {
      let root: AppBskyFeedPost.ReplyRef["root"] | undefined;
      let parent: AppBskyFeedPost.ReplyRef["parent"] | undefined;

      for (const part of parts) {
        const result = await bot.post(
          part,
          root && parent ? { root, parent } : undefined,
        );
        root ??= result;
        parent = result;
      }
    } else {
      for (const part of parts) {
        console.log(part);
      }
    }
    return text;
  }
}
