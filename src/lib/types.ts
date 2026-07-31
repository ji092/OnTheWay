/**
 * 앱 전역 공용 타입의 단일 정의처. 좌표·후보·카테고리는 프론트와 서버가 같은
 * 모양을 쓰므로 여기서만 정의하고, 다른 모듈은 import(또는 재수출)해서 쓴다.
 */

/** 좌표 표기: (x=경도, y=위도) — 카카오 API와 동일. */
export type Point = { x: number; y: number };

/** 경로 진행 방향 기준 좌/우 (판정 규약은 geo.ts §sideOfRoute). */
export type Side = "SAME" | "OPPOSITE" | "UNKNOWN";

export type Category = "dt" | "gas" | "restroom";

export type Place = { name: string; address: string; x: number; y: number };

export type Candidate = {
  placeId: string;
  name: string;
  x: number;
  y: number;
  distM: number;
  side: Side;
  category?: Category;
  approxExtraSec: number;
  /** 경유지를 넣었을 때 늘어나는 주행거리(왕복 근사). 상위 3개는 정밀치로 대체됨(FS-4). */
  approxExtraDistM: number;
  score: number;
};

export type SortStyle = "distance" | "time" | "recommended";

export const CATEGORY_LABEL: Record<"all" | Category, string> = {
  all: "전체",
  dt: "DT매장",
  gas: "주유소",
  restroom: "화장실",
};

export const CATEGORY_QUERY: Record<Category, string> = {
  dt: "드라이브스루",
  gas: "주유소",
  restroom: "화장실",
};
