export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type RateLimitBucket = {
  attempts: number;
  resetAt: number;
};

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxBuckets: number = 10_000,
  ) {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error("maxAttempts must be a positive integer");
    if (!Number.isFinite(windowMs) || windowMs < 1) throw new Error("windowMs must be positive");
    if (!Number.isInteger(maxBuckets) || maxBuckets < 1) throw new Error("maxBuckets must be a positive integer");
  }

  consume(key: string): RateLimitDecision {
    const now = this.now();
    const existing = this.buckets.get(key);
    if (existing && existing.resetAt <= now) this.buckets.delete(key);

    const active = this.buckets.get(key);
    if (!active) {
      if (this.buckets.size >= this.maxBuckets) this.pruneExpired(now);
      if (this.buckets.size >= this.maxBuckets) {
        return { allowed: false, retryAfterSeconds: this.capacityRetryAfterSeconds(now) };
      }
      this.buckets.set(key, { attempts: 1, resetAt: now + this.windowMs });
      return { allowed: true };
    }

    if (active.attempts >= this.maxAttempts) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((active.resetAt - now) / 1000)) };
    }

    active.attempts += 1;
    return { allowed: true };
  }

  reset(key: string) {
    this.buckets.delete(key);
  }

  private pruneExpired(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  private capacityRetryAfterSeconds(now: number) {
    let earliestReset = now + this.windowMs;
    for (const bucket of this.buckets.values()) earliestReset = Math.min(earliestReset, bucket.resetAt);
    return Math.max(1, Math.ceil((earliestReset - now) / 1000));
  }
}
