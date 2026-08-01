/**
 * WGS84(경위도) ↔ KATEC 좌표 변환.
 *
 * 오피넷 API는 요청·응답 모두 KATEC(TM 중부, Bessel 1841 타원체)을 쓰는데 이 앱의
 * 나머지는 전부 WGS84 경위도라 경계에서 변환이 필요하다. 타원체가 다르므로 투영
 * 변환만으로는 안 되고 데이텀 변환(towgs84 7-파라미터)까지 필요해서, 직접 구현하지
 * 않고 proj4에 맡긴다 — 파라미터를 하나만 틀려도 수백 m가 어긋난다.
 */
import proj4 from "proj4";
import type { Point } from "./types";

const WGS84 = "EPSG:4326";

/**
 * 국내 내비게이션에서 통용되는 KATEC 정의.
 * towgs84는 Bessel(구 지역측지계) → WGS84 7-파라미터 변환값.
 */
const KATEC =
  "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 " +
  "+ellps=bessel +units=m +no_defs " +
  "+towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43";

proj4.defs("KATEC", KATEC);

/** 경위도(x=경도, y=위도) → KATEC 미터 좌표. */
export function wgs84ToKatec(point: Point): Point {
  const [x, y] = proj4(WGS84, "KATEC", [point.x, point.y]);
  return { x, y };
}

/** KATEC 미터 좌표 → 경위도(x=경도, y=위도). */
export function katecToWgs84(point: Point): Point {
  const [x, y] = proj4("KATEC", WGS84, [point.x, point.y]);
  return { x, y };
}

/** 변환 결과가 한반도 범위를 벗어나면 좌표계를 잘못 넘긴 것 — 조용히 진행하지 않는다. */
export function isInKorea(point: Point): boolean {
  return point.x > 124 && point.x < 132 && point.y > 33 && point.y < 39;
}
