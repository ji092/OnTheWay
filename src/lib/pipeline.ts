/**
 * 경로 기반 POI 검색 파이프라인 (FS-2~FS-5, 00_SPEC 반영).
 * DB 없음 — 전부 인메모리. 카카오 POI는 응답 스코프 밖에 저장하지 않는다.
 */
import { searchKeyword } from "./kakao";
import { nearestSegment, sideOfRoute, sampleRoute, offsetPoint, type Point, type Side } from "./geo";

export type Category = "dt" | "gas" | "restroom";

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

type Candidate = {
  placeId: string;
  name: string;
  x: number;
  y: number;
  distM: number; // 이탈 거리
  side: Side;
  category?: Category;
  approxExtraSec: number;
  score: number;
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
    const x = parseFloat(doc.x);
    const y = parseFloat(doc.y);
    const { distM, segIdx } = nearestSegment(vertexes, x, y);
    if (distM > MAX_BUFFER_M) continue;

    const side = sideOfRoute(vertexes, segIdx, x, y);
    const extraSec = approxExtraSec(distM);
    const timeScore = 1 - Math.min(extraSec / 60 / 10, 1);
    const distScore = 1 - Math.min(distM / 500, 1);
    const dirScore = directionScore(side);
    const score = Math.round(100 * (0.5 * timeScore + 0.2 * distScore + 0.3 * dirScore)); // SPEC §10-D3

    candidates.push({
      placeId: doc.id,
      name: doc.place_name,
      x,
      y,
      distM: Math.round(distM),
      side,
      category,
      approxExtraSec: Math.round(extraSec),
      score,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}
