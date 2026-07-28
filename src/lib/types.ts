export type Place = { name: string; address: string; x: number; y: number };

export type Candidate = {
  placeId: string;
  name: string;
  x: number;
  y: number;
  distM: number;
  side: "SAME" | "OPPOSITE" | "UNKNOWN";
  category?: "dt" | "gas" | "restroom";
  approxExtraSec: number;
  score: number;
};

export type RouteResult = { routeId: string; vertexes: { x: number; y: number }[]; durationSec: number; distanceM: number };

export type SortStyle = "distance" | "time" | "recommended";

export const CATEGORY_LABEL: Record<"all" | "dt" | "gas" | "restroom", string> = {
  all: "전체",
  dt: "DT매장",
  gas: "주유소",
  restroom: "화장실",
};

export const CATEGORY_QUERY: Record<"dt" | "gas" | "restroom", string> = {
  dt: "드라이브스루",
  gas: "주유소",
  restroom: "화장실",
};
