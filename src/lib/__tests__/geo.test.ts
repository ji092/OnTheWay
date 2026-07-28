import { describe, it, expect } from "vitest";
import { nearestSegment, sideOfRoute, sampleRoute, offsetPoint, type Point } from "../geo";

describe("synthetic direction sign convention (00_SPEC §6b — highest-risk bug)", () => {
  it("남향 경로(정남 직진): 서쪽=오른쪽(SAME), 동쪽=왼쪽(OPPOSITE)", () => {
    // forward = (0, -e)  — 위도 감소 = 남쪽 진행
    // 근거: 남쪽으로 달리는 차량은 오른손이 서쪽을 가리킴 → 서쪽이 진행 방향 오른쪽.
    const route: Point[] = [
      { x: 127.0, y: 37.56 },
      { x: 127.0, y: 37.55 },
    ];
    const west = { x: 126.995, y: 37.555 };
    const east = { x: 127.005, y: 37.555 };

    const w = nearestSegment(route, west.x, west.y);
    const e = nearestSegment(route, east.x, east.y);

    expect(sideOfRoute(route, w.segIdx, west.x, west.y)).toBe("SAME");
    expect(sideOfRoute(route, e.segIdx, east.x, east.y)).toBe("OPPOSITE");
  });

  it("동향 경로(정동 직진): 북쪽=왼쪽(OPPOSITE), 남쪽=오른쪽(SAME)", () => {
    // forward = (+d, 0) — 경도 증가 = 동쪽 진행
    // 근거: 동쪽으로 달리는 차량은 왼손이 북쪽을 가리킴 → 북쪽이 진행 방향 왼쪽(유턴 필요).
    const route: Point[] = [
      { x: 126.97, y: 37.56 },
      { x: 126.98, y: 37.56 },
    ];
    const north = { x: 126.975, y: 37.565 };
    const south = { x: 126.975, y: 37.555 };

    const n = nearestSegment(route, north.x, north.y);
    const s = nearestSegment(route, south.x, south.y);

    expect(sideOfRoute(route, n.segIdx, north.x, north.y)).toBe("OPPOSITE");
    expect(sideOfRoute(route, s.segIdx, south.x, south.y)).toBe("SAME");
  });
});

describe("geo primitives (Python geo.py 이식 검증)", () => {
  // 서울시청 근처, 서→동 직선 경로
  const ROUTE: Point[] = [
    { x: 126.97, y: 37.56 },
    { x: 126.98, y: 37.56 },
    { x: 126.99, y: 37.56 },
  ];

  it("점-선분 거리: 경로 위 점은 0에 가깝고, 위도 0.001도(~110m) 떨어진 점은 ~110m", () => {
    const onRoute = nearestSegment(ROUTE, 126.975, 37.56);
    expect(onRoute.distM).toBeLessThan(1);

    const off = nearestSegment(ROUTE, 126.975, 37.561);
    expect(off.distM).toBeGreaterThan(100);
    expect(off.distM).toBeLessThan(120);
  });

  it("급커브(U턴 형태) → UNKNOWN", () => {
    const uturn: Point[] = [
      { x: 126.97, y: 37.56 },
      { x: 126.98, y: 37.56 },
      { x: 126.97, y: 37.5601 },
    ];
    expect(sideOfRoute(uturn, 1, 126.98, 37.561)).toBe("UNKNOWN");
  });

  it("샘플링: 시작·끝 포함, 개수는 합리적 범위", () => {
    const samples = sampleRoute(ROUTE, 500);
    expect(samples[0]).toEqual(ROUTE[0]);
    expect(samples[samples.length - 1]).toEqual(ROUTE[ROUTE.length - 1]);
    expect(samples.length).toBeGreaterThanOrEqual(3);
    expect(samples.length).toBeLessThanOrEqual(6);
  });

  it("offset_point 왕복 검증: 동쪽 1km 이동 후 거리 ~1km", () => {
    const offset = offsetPoint(126.98, 37.56, 1000, 0);
    const d = nearestSegment(
      [
        { x: 126.98, y: 37.56 },
        { x: 126.98, y: 37.5601 },
      ],
      offset.x,
      offset.y,
    );
    expect(d.distM).toBeGreaterThan(950);
    expect(d.distM).toBeLessThan(1050);
  });
});
