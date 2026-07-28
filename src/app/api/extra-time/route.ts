import { NextRequest, NextResponse } from "next/server";
import { waypointDirections, extractDuration } from "@/lib/kakao";
import { cacheGet } from "@/lib/cache";
import type { Point } from "@/lib/geo";

type Poi = { placeId: string; x: number; y: number };
type Body = { routeId: string; pois: Poi[] };
type CachedRoute = { vertexes: Point[]; durationSec: number; distanceM: number };

const MAX_POIS = 3;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.routeId || !Array.isArray(body.pois) || body.pois.length === 0) {
    return NextResponse.json(
      { error: "E-900", message: "routeId, pois[] required" },
      { status: 400 },
    );
  }

  const route = cacheGet<CachedRoute>(body.routeId);
  if (!route || route.vertexes.length < 2) {
    return NextResponse.json(
      { error: "E-204", message: "경로 정보가 만료되었습니다. /api/route를 다시 호출하세요." },
      { status: 410 },
    );
  }

  const origin = route.vertexes[0];
  const destination = route.vertexes[route.vertexes.length - 1];
  const pois = body.pois.slice(0, MAX_POIS);

  const results = await Promise.all(
    pois.map(async (poi) => {
      try {
        const resp = await waypointDirections(
          origin.x, origin.y, poi.x, poi.y, destination.x, destination.y,
        );
        const detourDuration = extractDuration(resp);
        const extraSec = Math.max(0, detourDuration - route.durationSec);
        return { placeId: poi.placeId, extraSec, approx: false };
      } catch {
        // 실패 시 근사치 유지 플래그만 세우고 나머지는 프론트가 기존 approxExtraSec 사용 (FS-4)
        return { placeId: poi.placeId, extraSec: null, approx: true };
      }
    }),
  );

  return NextResponse.json({ results });
}
