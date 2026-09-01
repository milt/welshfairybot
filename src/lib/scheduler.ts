export interface SchedulerDependencies {
  now: Date;
  nextPostAt?: string;
  minIntervalMinutes: number;
  maxIntervalMinutes: number;
  persistNextPostAt: (nextPostAt: string) => Promise<void>;
  post: () => Promise<void>;
  random?: () => number;
  log?: (message: string) => void;
}

export type SchedulerResult = "initialized" | "not-due" | "posted";

function validateIntervalRange(minMinutes: number, maxMinutes: number): void {
  if (!Number.isInteger(minMinutes) || minMinutes < 1) {
    throw new RangeError("Minimum post interval must be a positive integer.");
  }
  if (!Number.isInteger(maxMinutes) || maxMinutes < 1) {
    throw new RangeError("Maximum post interval must be a positive integer.");
  }
  if (minMinutes > maxMinutes) {
    throw new RangeError(
      "Minimum post interval cannot exceed maximum post interval.",
    );
  }
}

function parseTimestamp(timestamp: string | undefined): Date | undefined {
  if (!timestamp) {
    return undefined;
  }
  const milliseconds = Date.parse(timestamp);
  return Number.isNaN(milliseconds) ? undefined : new Date(milliseconds);
}

export function formatInterval(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }
  if (remainingMinutes > 0 || hours === 0) {
    parts.push(
      `${remainingMinutes} ${remainingMinutes === 1 ? "minute" : "minutes"}`,
    );
  }
  return parts.join(" ");
}

export function isPostDue(now: Date, nextPostAt: string): boolean {
  const nextPostDate = parseTimestamp(nextPostAt);
  return nextPostDate !== undefined && now.getTime() >= nextPostDate.getTime();
}

export function randomInterval(
  minMinutes: number,
  maxMinutes: number,
  random: () => number = Math.random,
): number {
  validateIntervalRange(minMinutes, maxMinutes);
  const randomValue = random();
  if (randomValue < 0 || randomValue >= 1) {
    throw new RangeError("Random source must return a value from 0 up to 1.");
  }
  return minMinutes + Math.floor(randomValue * (maxMinutes - minMinutes + 1));
}

export function calculateNextPostAt(
  now: Date,
  minMinutes: number,
  maxMinutes: number,
  random: () => number = Math.random,
): { intervalMinutes: number; nextPostAt: string } {
  const intervalMinutes = randomInterval(minMinutes, maxMinutes, random);
  return {
    intervalMinutes,
    nextPostAt: new Date(
      now.getTime() + intervalMinutes * 60_000,
    ).toISOString(),
  };
}

export async function runScheduler({
  now,
  nextPostAt,
  minIntervalMinutes,
  maxIntervalMinutes,
  persistNextPostAt,
  post,
  random = Math.random,
  log = console.log,
}: SchedulerDependencies): Promise<SchedulerResult> {
  validateIntervalRange(minIntervalMinutes, maxIntervalMinutes);
  const parsedNextPostAt = parseTimestamp(nextPostAt);

  if (!parsedNextPostAt) {
    const next = calculateNextPostAt(
      now,
      minIntervalMinutes,
      maxIntervalMinutes,
      random,
    );
    await persistNextPostAt(next.nextPostAt);
    log(
      `Scheduler state missing or invalid; initialized next post for ${next.nextPostAt} (in ${formatInterval(next.intervalMinutes)}).`,
    );
    return "initialized";
  }

  if (!isPostDue(now, nextPostAt as string)) {
    const minutesUntilPost = Math.ceil(
      (parsedNextPostAt.getTime() - now.getTime()) / 60_000,
    );
    log(
      `Next post scheduled for ${parsedNextPostAt.toISOString()} (in ${formatInterval(minutesUntilPost)}); nothing to do.`,
    );
    return "not-due";
  }

  log(`Scheduled time ${parsedNextPostAt.toISOString()} has been reached.`);
  const next = calculateNextPostAt(
    now,
    minIntervalMinutes,
    maxIntervalMinutes,
    random,
  );
  await persistNextPostAt(next.nextPostAt);
  log(
    `Selected ${formatInterval(next.intervalMinutes)} interval; persisted next post for ${next.nextPostAt}.`,
  );
  await post();
  log("Bluesky posting operation succeeded.");
  return "posted";
}
