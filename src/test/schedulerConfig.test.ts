import { describe, expect, it } from "vitest";
import { parseSchedulerConfig } from "../lib/schedulerConfig.js";

const requiredConfig = {
  SCHEDULER_GITHUB_TOKEN: "test-token",
  GITHUB_REPOSITORY: "owner/repository",
};

describe("scheduler configuration", () => {
  it("uses the default 3–12 hour interval", () => {
    const config = parseSchedulerConfig(requiredConfig);
    expect(config.MIN_POST_INTERVAL_MINUTES).toBe(180);
    expect(config.MAX_POST_INTERVAL_MINUTES).toBe(720);
  });

  it("accepts configured interval values", () => {
    const config = parseSchedulerConfig({
      ...requiredConfig,
      MIN_POST_INTERVAL_MINUTES: "60",
      MAX_POST_INTERVAL_MINUTES: "240",
    });
    expect(config.MIN_POST_INTERVAL_MINUTES).toBe(60);
    expect(config.MAX_POST_INTERVAL_MINUTES).toBe(240);
  });

  it("rejects a minimum greater than the maximum", () => {
    expect(() => parseSchedulerConfig({
      ...requiredConfig,
      MIN_POST_INTERVAL_MINUTES: "721",
      MAX_POST_INTERVAL_MINUTES: "720",
    })).toThrow("Minimum post interval cannot exceed maximum post interval.");
  });
});
