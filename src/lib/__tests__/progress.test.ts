import { describe, it, expect } from "vitest";
import { cumulativeLengths, progressAlongRoute, nearestSegment, type Point } from "../geo";

/** 서울 부근에서 서→동으로 곧게 뻗은 경로. 경도 0.01도 ≈ 880m. */
const ROUTE: Point[] = [
  { x: 126.97, y: 37.55 },
  { x: 126.98, y: 37.55 },
  { x: 126.99, y: 37.55 },
  { x: 127.0, y: 37.55 },
];

describe("경로 진행 거리", () => {
  it("누적 거리는 0에서 시작해 단조 증가한다", () => {
    const cum = cumulativeLengths(ROUTE);

    expect(cum[0]).toBe(0);
    for (let i = 1; i < cum.length; i++) {
      expect(cum[i]).toBeGreaterThan(cum[i - 1]);
    }
    // 총 0.03도 ≈ 2.6km
    expect(cum[cum.length - 1]).toBeGreaterThan(2000);
    expect(cum[cum.length - 1]).toBeLessThan(3200);
  });

  it("출발지 쪽 지점이 목적지 쪽 지점보다 진행 거리가 작다", () => {
    const cum = cumulativeLengths(ROUTE);
    const near = { x: 126.972, y: 37.551 }; // 출발지 근처
    const far = { x: 126.998, y: 37.551 }; // 목적지 근처

    const pNear = progressAlongRoute(ROUTE, cum, nearestSegment(ROUTE, near.x, near.y).segIdx, near.x, near.y);
    const pFar = progressAlongRoute(ROUTE, cum, nearestSegment(ROUTE, far.x, far.y).segIdx, far.x, far.y);

    expect(pNear).toBeLessThan(pFar);
    expect(pNear).toBeLessThan(300);
  });

  // 경로에서 떨어져 있어도 "경로상 어디쯤인지"는 수직으로 내린 지점 기준이어야 한다.
  it("경로에서 벗어난 지점도 투영 위치로 판단한다", () => {
    const cum = cumulativeLengths(ROUTE);
    const onRoute = { x: 126.985, y: 37.55 };
    const offRoute = { x: 126.985, y: 37.554 }; // 같은 경도, 북쪽으로 이탈

    const a = progressAlongRoute(ROUTE, cum, nearestSegment(ROUTE, onRoute.x, onRoute.y).segIdx, onRoute.x, onRoute.y);
    const b = progressAlongRoute(ROUTE, cum, nearestSegment(ROUTE, offRoute.x, offRoute.y).segIdx, offRoute.x, offRoute.y);

    expect(Math.abs(a - b)).toBeLessThan(30);
  });

  it("좌표가 2개 미만이면 0을 돌려준다", () => {
    expect(progressAlongRoute([], [], 0, 127, 37.5)).toBe(0);
    expect(progressAlongRoute([{ x: 127, y: 37.5 }], [0], 0, 127, 37.5)).toBe(0);
  });
});
