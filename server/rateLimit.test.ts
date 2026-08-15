import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter } from "./rateLimit.js";

describe("FixedWindowRateLimiter", () => {
  it("blocks after the configured attempts and opens a fresh window", () => {
    let now = 10_000;
    const limiter = new FixedWindowRateLimiter(2, 5_000, () => now);

    expect(limiter.consume("user:1")).toEqual({ allowed: true });
    expect(limiter.consume("user:1")).toEqual({ allowed: true });
    expect(limiter.consume("user:1")).toEqual({ allowed: false, retryAfterSeconds: 5 });
    expect(limiter.consume("user:2")).toEqual({ allowed: true });

    now += 5_000;
    expect(limiter.consume("user:1")).toEqual({ allowed: true });
  });

  it("resets a key after successful authentication", () => {
    const limiter = new FixedWindowRateLimiter(1, 5_000);
    expect(limiter.consume("user:1")).toEqual({ allowed: true });
    limiter.reset("user:1");
    expect(limiter.consume("user:1")).toEqual({ allowed: true });
  });

  it("bounds active buckets and prunes them after expiry", () => {
    let now = 10_000;
    const limiter = new FixedWindowRateLimiter(2, 5_000, () => now, 2);

    expect(limiter.consume("user:1")).toEqual({ allowed: true });
    expect(limiter.consume("user:2")).toEqual({ allowed: true });
    expect(limiter.consume("user:3")).toEqual({ allowed: false, retryAfterSeconds: 5 });

    now += 5_000;
    expect(limiter.consume("user:3")).toEqual({ allowed: true });
    expect(limiter.consume("user:4")).toEqual({ allowed: true });
    expect(limiter.consume("user:5")).toEqual({ allowed: false, retryAfterSeconds: 5 });
  });
});
