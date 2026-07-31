/**
 * 카카오 API 서버 클라이언트 — 유일한 외부 호출 경로.
 * REST 키는 서버 전용 환경변수(KAKAO_REST_KEY)로만 주입. 절대 클라이언트에 노출하지 않는다.
 * 이 파일은 API Route(서버)에서만 import할 것 — "use client" 컴포넌트에서 import 금지.
 */

import type { Point } from "./types";
import { consumeQuota, QuotaExceededError } from "./quota";

const LOCAL_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const DIRECTIONS_URL = "https://apis-navi.kakaomobility.com/v1/directions";
const WAYPOINTS_URL = "https://apis-navi.kakaomobility.com/v1/waypoints/directions";

function authHeaders(): HeadersInit {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) throw new Error("KAKAO_REST_KEY not set");
  return { Authorization: `KakaoAK ${key}` };
}

export class KakaoApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * 카카오는 200으로 응답했지만 경로가 없는 경우(result_code≠0, 빈 routes).
 * 호출부가 "경로 없음"과 진짜 예외를 구분할 수 있어야 오류 메시지가 정직해진다.
 */
export class NoRouteError extends Error {}

/**
 * 호출 계측 카운터 (NR-03 — /api/health 노출용). 프로세스 인메모리이므로 서버리스
 * 다중 인스턴스에서는 인스턴스별로 별도 카운트가 생기는 한계가 있음 — 데모 규모에선 무방.
 * 재시도 포함 실제 호출 시도 수를 그대로 반영(재시도도 쿼터를 소모하므로).
 */
export const callCounts = { local: 0, directions: 0, waypoints: 0 };

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

function isRetriable(err: unknown): boolean {
  // 예산 초과는 재시도할수록 상황만 나빠진다 — 애초에 호출을 안 한 것이므로 즉시 포기.
  if (err instanceof QuotaExceededError) return false;
  // 네트워크 자체 실패(TypeError 등)나 5xx만 재시도 — 4xx(요청 자체가 잘못됨)는 재시도해도 똑같이 실패함
  if (err instanceof KakaoApiError) return err.status >= 500;
  return true;
}

/** 일시적 오류(네트워크 실패/5xx)만 지수 백오프로 재시도. 4xx는 즉시 실패시킴. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS || !isRetriable(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** (attempt - 1)));
    }
  }
  throw lastErr;
}

async function kakaoGet(
  kind: keyof typeof callCounts,
  url: string,
  params: Record<string, string>,
): Promise<unknown> {
  const qs = new URLSearchParams(params).toString();
  return withRetry(async () => {
    consumeQuota(); // 재시도도 쿼터를 소모하므로 시도마다 차감
    callCounts[kind]++;
    const res = await fetch(`${url}?${qs}`, { headers: authHeaders() });
    if (!res.ok) {
      const body = await res.text();
      throw new KakaoApiError(res.status, `${res.status} ${body.slice(0, 300)}`);
    }
    return res.json();
  });
}

/** 다중 경유지 API 전용 — GET이 아니라 POST + JSON body 필요 (단일 목적지 Directions와 다름). */
async function kakaoPost(
  kind: keyof typeof callCounts,
  url: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  return withRetry(async () => {
    consumeQuota();
    callCounts[kind]++;
    const res = await fetch(url, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new KakaoApiError(res.status, `${res.status} ${text.slice(0, 300)}`);
    }
    return res.json();
  });
}

/** 경로 기반 POI 수집용 — sort=distance 필수 (SPEC §10-D4). 지명 자동완성에는 쓰지 말 것. */
export async function searchKeyword(query: string, x: number, y: number, radiusM: number, page = 1) {
  return kakaoGet("local", LOCAL_KEYWORD_URL, {
    query,
    x: String(x),
    y: String(y),
    radius: String(Math.min(radiusM, 20000)),
    sort: "distance",
    size: "15",
    page: String(page),
  });
}

/** 지명/장소 자동완성용 — sort=accuracy(기본값), sort=distance 쓰지 말 것 (SPEC §10-D4). */
export async function searchPlaceByName(query: string) {
  return kakaoGet("local", LOCAL_KEYWORD_URL, { query, size: "8", page: "1" });
}

export async function directions(ox: number, oy: number, dx: number, dy: number) {
  return kakaoGet("directions", DIRECTIONS_URL, {
    origin: `${ox},${oy}`,
    destination: `${dx},${dy}`,
  });
}

export async function waypointDirections(
  ox: number, oy: number, wx: number, wy: number, dx: number, dy: number,
) {
  return kakaoPost("waypoints", WAYPOINTS_URL, {
    origin: { x: String(ox), y: String(oy) },
    destination: { x: String(dx), y: String(dy) },
    waypoints: [{ name: "waypoint", x: wx, y: wy }],
  });
}

/** 길찾기 응답 → (vertexes, duration_sec, distance_m). 경로 없음/실패 시 throw. */
export function extractVertexes(directionsResp: unknown): {
  vertexes: Point[];
  durationSec: number;
  distanceM: number;
} {
  const resp = directionsResp as {
    routes?: Array<{
      result_code: number;
      result_msg?: string;
      sections?: Array<{ roads?: Array<{ vertexes?: number[] }> }>;
      summary: { duration: number; distance: number };
    }>;
  };
  const routes = resp.routes ?? [];
  const route = routes[0];
  if (!route || route.result_code !== 0) {
    throw new NoRouteError(route?.result_msg ?? "no route");
  }
  const vertexes: Point[] = [];
  for (const section of route.sections ?? []) {
    for (const road of section.roads ?? []) {
      const flat = road.vertexes ?? [];
      for (let i = 0; i < flat.length - 1; i += 2) {
        vertexes.push({ x: flat[i], y: flat[i + 1] });
      }
    }
  }
  return {
    vertexes,
    durationSec: Math.round(route.summary.duration),
    distanceM: Math.round(route.summary.distance),
  };
}

/** 경유지 포함 길찾기 응답 → (duration_sec, distance_m). 경로 없음/실패 시 throw. */
export function extractSummary(directionsResp: unknown): {
  durationSec: number;
  distanceM: number;
} {
  const resp = directionsResp as {
    routes?: Array<{
      result_code: number;
      result_msg?: string;
      summary: { duration: number; distance: number };
    }>;
  };
  const route = (resp.routes ?? [])[0];
  if (!route || route.result_code !== 0) {
    throw new NoRouteError(route?.result_msg ?? "no route");
  }
  const { duration, distance } = route.summary;
  if (!Number.isFinite(duration) || !Number.isFinite(distance)) {
    throw new Error("summary missing duration/distance");
  }
  return { durationSec: Math.round(duration), distanceM: Math.round(distance) };
}
