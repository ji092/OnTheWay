/**
 * 경로 캐시 접근 계층 — /api/route, /api/search, /api/extra-time이 공유한다.
 * 타입·TTL·만료 응답을 여기 한 곳에 모아 라우트별 복붙을 없앤다.
 * 카카오 유래 응답의 단기 TTL 캐시는 SPEC §10-D1이 허용하는 범위.
 */
import { cacheGet, cacheSet, TEN_MIN_MS } from "./cache";
import type { Candidate, Point } from "./types";

export type CachedRoute = { vertexes: Point[]; durationSec: number; distanceM: number };

export function getCachedRoute(routeId: string): CachedRoute | undefined {
  return cacheGet<CachedRoute>(routeId);
}

export function setCachedRoute(routeId: string, route: CachedRoute): void {
  cacheSet(routeId, route, TEN_MIN_MS);
}

/** routeId가 만료됐을 때의 공통 응답 본문 — 프론트가 /api/route를 다시 호출하는 신호. */
export const ROUTE_EXPIRED_BODY = {
  error: "E-204",
  message: "경로 정보가 만료되었습니다. /api/route를 다시 호출하세요.",
} as const;
export const ROUTE_EXPIRED_STATUS = 410;

/**
 * 같은 경로·같은 키워드의 POI 검색 결과 재사용 — 카테고리 탭을 오갈 때마다
 * 카카오를 다시 때리지 않기 위함. 경로 캐시와 수명을 맞춰 함께 만료시킨다.
 */
function searchKey(routeId: string, query: string): string {
  return `search:${routeId}:${query}`;
}

export function getCachedSearch(routeId: string, query: string): Candidate[] | undefined {
  return cacheGet<Candidate[]>(searchKey(routeId, query));
}

export function setCachedSearch(routeId: string, query: string, candidates: Candidate[]): void {
  cacheSet(searchKey(routeId, query), candidates, TEN_MIN_MS);
}
