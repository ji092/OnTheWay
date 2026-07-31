import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, RATE_LIMITS, resetRateLimits } from "../rateLimit";
import { consumeQuota, quotaStatus, resetQuota, QuotaExceededError } from "../quota";
import type { NextRequest } from "next/server";

/** checkRateLimit이 실제로 읽는 건 헤더뿐이라 최소한만 흉내낸다. */
function reqFrom(ip: string): NextRequest {
  return { headers: new Headers({ "x-forwarded-for": ip }) } as unknown as NextRequest;
}

beforeEach(() => {
  resetRateLimits();
  resetQuota();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("레이트리밋", () => {
  it("한도까지는 통과시키고 넘으면 막는다", () => {
    const req = reqFrom("1.1.1.1");
    const { limit } = RATE_LIMITS.search;

    for (let i = 0; i < limit; i++) {
      expect(checkRateLimit(req, "search").ok).toBe(true);
    }
    const blocked = checkRateLimit(req, "search");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("IP가 다르면 서로 영향을 주지 않는다", () => {
    const { limit } = RATE_LIMITS.search;
    for (let i = 0; i < limit; i++) checkRateLimit(reqFrom("1.1.1.1"), "search");

    expect(checkRateLimit(reqFrom("1.1.1.1"), "search").ok).toBe(false);
    expect(checkRateLimit(reqFrom("2.2.2.2"), "search").ok).toBe(true);
  });

  // 자동완성 때문에 검색이 막히면 안 된다.
  it("엔드포인트별로 한도가 따로 센다", () => {
    const req = reqFrom("3.3.3.3");
    for (let i = 0; i < RATE_LIMITS.search.limit; i++) checkRateLimit(req, "search");

    expect(checkRateLimit(req, "search").ok).toBe(false);
    expect(checkRateLimit(req, "placeSearch").ok).toBe(true);
  });

  it("윈도우가 지나면 다시 허용된다", () => {
    vi.useFakeTimers();
    const req = reqFrom("4.4.4.4");
    for (let i = 0; i < RATE_LIMITS.search.limit; i++) checkRateLimit(req, "search");
    expect(checkRateLimit(req, "search").ok).toBe(false);

    vi.advanceTimersByTime(RATE_LIMITS.search.windowMs + 1);
    expect(checkRateLimit(req, "search").ok).toBe(true);
  });
});

describe("일일 호출 예산", () => {
  it("예산을 넘으면 호출 전에 막는다", () => {
    const budget = quotaStatus().budget;
    for (let i = 0; i < budget; i++) consumeQuota();

    expect(() => consumeQuota()).toThrow(QuotaExceededError);
    expect(quotaStatus().used).toBe(budget);
  });

  it("KST 날짜가 바뀌면 초기화된다", () => {
    consumeQuota();
    expect(quotaStatus().used).toBe(1);

    const tomorrow = Date.now() + 86_400_000;
    consumeQuota(tomorrow);
    expect(quotaStatus(tomorrow).used).toBe(1);
  });
});
