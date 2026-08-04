/**
 * IP 단위 슬라이딩 윈도우 레이트리밋 (인메모리).
 *
 * 목적은 "봇/스크립트의 난사로 카카오 쿼터가 증발하는 것"을 막는 것이지, 정교한
 * 접근 제어가 아니다. 서버리스에서는 인스턴스마다 카운터가 따로 존재하므로 실제
 * 허용량은 (한도 × 인스턴스 수)까지 늘어날 수 있다 — 캐시·callCounts와 동일한
 * 알려진 제약(SPEC §10-D6). 정확한 전역 제한이 필요해지면 공유 저장소가 필요하다.
 */
import type { NextRequest } from "next/server";

type Window = { hits: number[] };

const windows = new Map<string, Window>();

export type RateLimitRule = { limit: number; windowMs: number };

/** 엔드포인트별 한도 — 카카오 호출을 많이 유발하는 순서로 빡빡하게 잡는다. */
export const RATE_LIMITS = {
  /** 1회 호출이 카카오 local을 10회 가까이 태운다("전체" 탭이면 3배). */
  search: { limit: 15, windowMs: 60_000 },
  /** 타이핑 자동완성 — 300ms 디바운스 기준 정상 사용은 분당 10~20회 수준. */
  placeSearch: { limit: 40, windowMs: 60_000 },
  route: { limit: 15, windowMs: 60_000 },
  extraTime: { limit: 30, windowMs: 60_000 },
  /**
   * 외부 API를 부르지 않아 쿼터와는 무관하지만, 호출 계측·예산 잔량을 공개하므로
   * 긁어가기 좋은 표적이다. 진단용으로 쓰기엔 넉넉하고 수집당하기엔 성가신 선.
   */
  health: { limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * 프록시 뒤(Vercel)에서는 x-forwarded-for의 첫 값이 클라이언트 IP.
 * 위조 가능하지만, 위조까지 하는 상대는 어차피 인메모리 제한으로 못 막는다.
 */
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export type RateLimitResult = { ok: boolean; retryAfterSec: number };

export function checkRateLimit(
  req: NextRequest,
  name: keyof typeof RATE_LIMITS,
): RateLimitResult {
  const { limit, windowMs } = RATE_LIMITS[name];
  const now = Date.now();
  const bucket = `${name}:${clientIp(req)}`;

  const window = windows.get(bucket) ?? { hits: [] };
  const hits = window.hits.filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    windows.set(bucket, { hits });
    const oldest = hits[0];
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
  }

  hits.push(now);
  windows.set(bucket, { hits });
  sweep(now);
  return { ok: true, retryAfterSec: 0 };
}

/** 오래된 버킷 정리 — 저장만 되고 다시 조회되지 않는 IP가 쌓이지 않도록. */
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  const maxWindow = Math.max(...Object.values(RATE_LIMITS).map((r) => r.windowMs));
  for (const [bucket, window] of windows) {
    if (window.hits.every((t) => now - t >= maxWindow)) windows.delete(bucket);
  }
}

export const RATE_LIMITED_BODY = {
  error: "E-901",
  message: "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.",
} as const;
export const RATE_LIMITED_STATUS = 429;

/** 테스트용 — 인메모리 상태를 비운다. */
export function resetRateLimits(): void {
  windows.clear();
  lastSweep = 0;
}
