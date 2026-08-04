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

/**
 * routeId가 만료됐을 때의 공통 응답 본문 — 프론트가 경로를 다시 받아오는 신호.
 * 메시지는 화면에 그대로 노출되므로 사용자 언어로 쓴다. 복구 절차(엔드포인트 재호출)는
 * 프론트가 알아서 하는 일이라 사용자에게 지시하지 않는다.
 */
export const ROUTE_EXPIRED_BODY = {
  error: "E-204",
  message: "경로 정보가 만료되었어요. 다시 검색해주세요.",
} as const;
export const ROUTE_EXPIRED_STATUS = 410;

/**
 * 같은 경로·같은 카테고리의 POI 검색 결과 재사용 — 카테고리 탭을 오갈 때마다
 * 카카오를 다시 때리지 않기 위함. 경로 캐시와 수명을 맞춰 함께 만료시킨다.
 *
 * 키에 category까지 넣는 이유: 고급유만 출처가 오피넷이라 같은 query라도 결과가 다르다.
 * query만으로 키를 만들면 출처가 다른 결과가 같은 칸에 섞인다.
 */
function searchKey(routeId: string, query: string, category?: string): string {
  return `search:${routeId}:${category ?? "-"}:${query}`;
}

export function getCachedSearch(
  routeId: string,
  query: string,
  category?: string,
): Candidate[] | undefined {
  return cacheGet<Candidate[]>(searchKey(routeId, query, category));
}

export function setCachedSearch(
  routeId: string,
  query: string,
  candidates: Candidate[],
  category?: string,
): void {
  cacheSet(searchKey(routeId, query, category), candidates, TEN_MIN_MS);
}
