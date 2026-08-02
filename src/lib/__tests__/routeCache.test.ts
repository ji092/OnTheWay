import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getCachedRoute,
  setCachedRoute,
  getCachedSearch,
  setCachedSearch,
  type CachedRoute,
} from "../routeCache";
import type { Candidate } from "../types";

const ROUTE: CachedRoute = {
  vertexes: [
    { x: 126.97, y: 37.55 },
    { x: 127.02, y: 37.5 },
  ],
  durationSec: 1800,
  distanceM: 12000,
};

const CANDIDATE: Candidate = {
  placeId: "p1",
  name: "테스트 주유소",
  x: 127.0,
  y: 37.52,
  distM: 120,
  side: "SAME",
  category: "gas",
  approxExtraSec: 89,
  approxExtraDistM: 240,
  routeProgressM: 3200,
  score: 88,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("경로 캐시", () => {
  it("저장한 경로를 그대로 돌려주고 TTL이 지나면 버린다", () => {
    vi.useFakeTimers();
    setCachedRoute("r1", ROUTE);
    expect(getCachedRoute("r1")).toEqual(ROUTE);

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(getCachedRoute("r1")).toBeUndefined();
  });
});

describe("검색 결과 캐시", () => {
  // 카테고리 탭마다 query가 다르므로, 키가 섞이면 엉뚱한 카테고리 결과가 나온다.
  it("routeId와 query 조합별로 분리된다", () => {
    setCachedSearch("r2", "주유소", [CANDIDATE]);

    expect(getCachedSearch("r2", "주유소")).toEqual([CANDIDATE]);
    expect(getCachedSearch("r2", "화장실")).toBeUndefined();
    expect(getCachedSearch("다른경로", "주유소")).toBeUndefined();
  });

  it("경로 캐시 키와 충돌하지 않는다", () => {
    setCachedRoute("r3", ROUTE);
    setCachedSearch("r3", "드라이브스루", [CANDIDATE]);

    expect(getCachedRoute("r3")).toEqual(ROUTE);
    expect(getCachedSearch("r3", "드라이브스루")).toEqual([CANDIDATE]);
  });
});
