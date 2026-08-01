/**
 * 앱 전역 공용 타입의 단일 정의처. 좌표·후보·카테고리는 프론트와 서버가 같은
 * 모양을 쓰므로 여기서만 정의하고, 다른 모듈은 import(또는 재수출)해서 쓴다.
 */

/** 좌표 표기: (x=경도, y=위도) — 카카오 API와 동일. */
export type Point = { x: number; y: number };

/** 경로 진행 방향 기준 좌/우 (판정 규약은 geo.ts §sideOfRoute). */
export type Side = "SAME" | "OPPOSITE" | "UNKNOWN";

export type Category = "dt" | "gas" | "gasPremium" | "restroom";

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
  /** 고급유(오피넷) 후보만 채워짐 — 원/L. */
  price?: number;
  score: number;
};

export type SortStyle = "distance" | "time" | "recommended";

export const CATEGORY_LABEL: Record<"all" | Category, string> = {
  all: "전체",
  dt: "DT매장",
  gas: "주유소",
  gasPremium: "고급유",
  restroom: "화장실",
};

/**
 * 카테고리 → 검색 키워드. gasPremium만 카카오가 아니라 오피넷을 쓰므로 키워드는
 * 캐시 키 겸 표시용이다(카카오 키워드 검색으로는 고급유 취급 여부를 알 수 없음).
 */
export const CATEGORY_QUERY: Record<Category, string> = {
  dt: "드라이브스루",
  gas: "주유소",
  gasPremium: "고급유",
  restroom: "화장실",
};
