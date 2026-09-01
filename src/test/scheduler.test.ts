import { describe, expect, it, vi } from "vitest";
import {
  calculateNextPostAt,
  formatInterval,
  isPostDue,
  randomInterval,
  runScheduler,
} from "../lib/scheduler.js";

const now = new Date("2026-09-01T12:00:00.000Z");

function dependencies(nextPostAt?: string) {
  return {
    now,
    nextPostAt,
    minIntervalMinutes: 180,
    maxIntervalMinutes: 720,
    persistNextPostAt: vi.fn(async () => undefined),
    post: vi.fn(async () => undefined),
    random: () => 0,
    log: vi.fn(),
  };
}

describe("scheduler", () => {
  it("does nothing when the next post is in the future", async () => {
    const options = dependencies("2026-09-01T12:01:00Z");
    await expect(runScheduler(options)).resolves.toBe("not-due");
    expect(options.persistNextPostAt).not.toHaveBeenCalled();
    expect(options.post).not.toHaveBeenCalled();
    expect(options.log).toHaveBeenCalledWith(
      expect.stringContaining("in 1 minute"),
    );
  });

  it("formats intervals for readable logs", () => {
    expect(formatInterval(1)).toBe("1 minute");
    expect(formatInterval(60)).toBe("1 hour");
    expect(formatInterval(195)).toBe("3 hours 15 minutes");
  });

  it("treats an equal timestamp as due", () => {
    expect(isPostDue(now, "2026-09-01T12:00:00Z")).toBe(true);
  });

  it("treats an earlier timestamp as due", () => {
    expect(isPostDue(now, "2026-09-01T11:59:59Z")).toBe(true);
  });

  it.each([undefined, "not-a-timestamp"])(
    "initializes missing or invalid state without posting",
    async (nextPostAt) => {
      const options = dependencies(nextPostAt);
      await expect(runScheduler(options)).resolves.toBe("initialized");
      expect(options.persistNextPostAt).toHaveBeenCalledOnce();
      expect(options.post).not.toHaveBeenCalled();
      expect(options.log).toHaveBeenCalledWith(
        expect.stringContaining("in 3 hours"),
      );
    },
  );

  it("generates inclusive minimum and maximum intervals", () => {
    expect(randomInterval(180, 720, () => 0)).toBe(180);
    expect(randomInterval(180, 720, () => 1 - Number.EPSILON)).toBe(720);
  });

  it("calculates the next timestamp from the selected interval", () => {
    expect(calculateNextPostAt(now, 180, 720, () => 0)).toEqual({
      intervalMinutes: 180,
      nextPostAt: "2026-09-01T15:00:00.000Z",
    });
  });

  it("persists state before posting", async () => {
    const events: string[] = [];
    const options = dependencies("2026-09-01T11:00:00Z");
    options.persistNextPostAt = vi.fn(async () => {
      events.push("persist");
    });
    options.post = vi.fn(async () => {
      events.push("post");
    });
    await expect(runScheduler(options)).resolves.toBe("posted");
    expect(events).toEqual(["persist", "post"]);
  });

  it("does not post when persistence fails", async () => {
    const options = dependencies("2026-09-01T11:00:00Z");
    options.persistNextPostAt.mockRejectedValue(new Error("write failed"));
    await expect(runScheduler(options)).rejects.toThrow("write failed");
    expect(options.post).not.toHaveBeenCalled();
  });

  it("rejects a minimum interval greater than the maximum", () => {
    expect(() => randomInterval(721, 720)).toThrow(
      "Minimum post interval cannot exceed maximum post interval.",
    );
  });
});
