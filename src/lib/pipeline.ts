/**
 * 경로 기반 POI 검색 파이프라인 (FS-2~FS-5, 00_SPEC 반영).
 * DB 없음 — 영속 저장 일절 없음. 결과는 routeCache의 단기 TTL 인메모리 캐시까지만
 * 재사용한다(카카오 유래 응답에 한해 SPEC §10-D1이 허용하는 범위).
 */
import { searchKeyword } from "./kakao";
import { nearestSegment, sideOfRoute, sampleRoute, offsetPoint, type Point } from "./geo";
import type { Candidate, Category, Side } from "./types";
import { stationsAround, PRODUCT, MAX_RADIUS_M, type Station } from "./opinet";

export type { Category };

const MAX_BUFFER_M = 1000; // 최대 버퍼(수집 기준) — 사용자 설정은 이 이내에서 클라이언트 재필터링
const CONCURRENCY = 5;
const MAX_SPLIT_DEPTH = 3;

type KakaoDoc = {
  id: string;
  place_name: string;
  x: string; // 경도(lng), string
  y: string; // 위도(lat), string
  category_name?: string;
  place_url?: string;
};

type KakaoSearchResp = {
  documents: KakaoDoc[];
  meta: { total_count: number; pageable_count: number; is_end: boolean };
};

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** 단일 원 검색 — total_count>45면 4분할 재귀 (FS-2-2). 결과는 원시 카카오 문서 배열. */
async function searchCircle(
  query: string,
  x: number,
  y: number,
  radiusM: number,
  depth: number,
): Promise<KakaoDoc[]> {
  const first = (await searchKeyword(query, x, y, radiusM, 1)) as KakaoSearchResp;
  const totalCount = first.meta.total_count;

  if (totalCount <= 45) {
    const docs = [...first.documents];
    const pages = Math.min(3, Math.ceil(totalCount / 15));
    for (let page = 2; page <= pages; page++) {
      const resp = (await searchKeyword(query, x, y, radiusM, page)) as KakaoSearchResp;
      docs.push(...resp.documents);
    }
    return docs;
  }

  if (depth >= MAX_SPLIT_DEPTH) {
    return first.documents; // 수집분으로 진행 (E-202 상당 — 로그만 남기고 계속)
  }

  const half = radiusM / 2;
  const offsets: [number, number][] = [
    [half, 0],
    [-half, 0],
    [0, half],
    [0, -half],
  ];
  const subResults = await Promise.all(
    offsets.map(([dx, dy]) => {
      const p = offsetPoint(x, y, dx, dy);
      return searchCircle(query, p.x, p.y, half, depth + 1);
    }),
  );
  return subResults.flat();
}

function approxExtraSec(distM: number): number {
  const V_LOCAL_MPS = 8.3; // 30km/h 가정
  const STOP_PENALTY_SEC = 60;
  return (distM * 2) / V_LOCAL_MPS + STOP_PENALTY_SEC;
}

/** 경로를 벗어났다 돌아오는 왕복분 — 정밀치(/api/extra-time)를 받기 전까지 쓰는 근사. */
function approxExtraDistM(distM: number): number {
  return distM * 2;
}

function directionScore(side: Side): number {
  if (side === "SAME") return 1.0;
  if (side === "OPPOSITE") return 0.0;
  return 0.5; // UNKNOWN (SPEC §10-D3)
}

export async function searchAlongRoute(
  vertexes: Point[],
  query: string,
  category?: Category,
): Promise<Candidate[]> {
  const samples = sampleRoute(vertexes, 3000 * 1.7); // 기본 반경 3km 가정 (FS-2-1 간소화)
  const perSample = await mapConcurrent(samples, CONCURRENCY, (p) => searchCircle(query, p.x, p.y, 3000, 0));

  const seen = new Map<string, KakaoDoc>();
  for (const docs of perSample) {
    for (const doc of docs) {
      if (!seen.has(doc.id)) seen.set(doc.id, doc);
    }
  }

  const candidates: Candidate[] = [];
  for (const doc of seen.values()) {
    const candidate = buildCandidate(vertexes, {
      placeId: doc.id,
      name: doc.place_name,
      x: parseFloat(doc.x),
      y: parseFloat(doc.y),
      category,
    });
    if (candidate) candidates.push(candidate);
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

type PoiInput = {
  placeId: string;
  name: string;
  x: number;
  y: number;
  category?: Category;
  price?: number;
};

/**
 * POI 한 건을 경로 기준으로 평가해 후보로 만든다. 버퍼 밖이면 null.
 * 카카오/오피넷 어느 출처든 같은 기준으로 점수가 매겨져야 하므로 여기 하나만 쓴다.
 */
function buildCandidate(vertexes: Point[], poi: PoiInput): Candidate | null {
  const { distM, segIdx } = nearestSegment(vertexes, poi.x, poi.y);
  if (distM > MAX_BUFFER_M) return null;

  const side = sideOfRoute(vertexes, segIdx, poi.x, poi.y);
  const extraSec = approxExtraSec(distM);
  const timeScore = 1 - Math.min(extraSec / 60 / 10, 1);
  const distScore = 1 - Math.min(distM / 500, 1);
  const dirScore = directionScore(side);
  const score = Math.round(100 * (0.5 * timeScore + 0.2 * distScore + 0.3 * dirScore)); // SPEC §10-D3

  return {
    placeId: poi.placeId,
    name: poi.name,
    x: poi.x,
    y: poi.y,
    distM: Math.round(distM),
    side,
    category: poi.category,
    approxExtraSec: Math.round(extraSec),
    approxExtraDistM: Math.round(approxExtraDistM(distM)),
    ...(poi.price ? { price: poi.price } : {}),
    score,
  };
}

/**
 * 고급휘발유 취급 주유소 — 카카오가 아니라 오피넷에서 수집한다(FS-2 변형).
 * 오피넷 반경 상한이 5km라 카카오(3km)보다 샘플 간격이 넓어 호출 수도 적다.
 */
export async function searchPremiumGasAlongRoute(vertexes: Point[]): Promise<Candidate[]> {
  const samples = sampleRoute(vertexes, MAX_RADIUS_M * 1.7);
  const perSample = await mapConcurrent(samples, CONCURRENCY, (p) =>
    stationsAround(p, MAX_RADIUS_M, PRODUCT.premiumGasoline),
  );

  const seen = new Map<string, Station>();
  for (const stations of perSample) {
    for (const station of stations) {
      if (!seen.has(station.id)) seen.set(station.id, station);
    }
  }

  const candidates: Candidate[] = [];
  for (const station of seen.values()) {
    const candidate = buildCandidate(vertexes, {
      placeId: `opinet:${station.id}`,
      name: station.name,
      x: station.x,
      y: station.y,
      category: "gasPremium",
      price: station.price,
    });
    if (candidate) candidates.push(candidate);
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}
