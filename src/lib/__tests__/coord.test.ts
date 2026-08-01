import { describe, it, expect } from "vitest";
import { wgs84ToKatec, katecToWgs84, isInKorea } from "../coord";

describe("WGS84 ↔ KATEC 변환", () => {
  /**
   * 오피넷 API 가이드의 "반경 내 주유소" 사용 예시에 실린 좌표.
   * 데이텀 파라미터가 틀리면 수백 m~수 km 어긋나므로, 실제 문서 예시가
   * 서울 강남 일대로 떨어지는지로 정합성을 확인한다.
   */
  it("오피넷 문서 예시 KATEC 좌표가 강남 일대로 변환된다", () => {
    const wgs = katecToWgs84({ x: 314681.8, y: 544837 });

    expect(wgs.x).toBeCloseTo(127.03, 1);
    expect(wgs.y).toBeCloseTo(37.5, 1);
    expect(isInKorea(wgs)).toBe(true);
  });

  it("왕복 변환 오차가 1m 미만", () => {
    const points = [
      { name: "서울시청", x: 126.978, y: 37.5665 },
      { name: "강남역", x: 127.0276, y: 37.4979 },
      { name: "부산시청", x: 129.0756, y: 35.1796 },
    ];

    for (const p of points) {
      const back = katecToWgs84(wgs84ToKatec(p));
      const errorM = Math.hypot((back.x - p.x) * 88_000, (back.y - p.y) * 111_000);
      expect(errorM, p.name).toBeLessThan(1);
    }
  });

  it("한반도 범위 판정", () => {
    expect(isInKorea({ x: 127.0, y: 37.5 })).toBe(true);
    // KATEC 좌표를 그대로 경위도로 넘긴 경우 — 이 검사에 걸려야 한다.
    expect(isInKorea({ x: 314681.8, y: 544837 })).toBe(false);
  });
});
