import { NextRequest, NextResponse } from "next/server";
import { waypointDirections, extractSummary } from "@/lib/kakao";
import {
  checkRateLimit,
  RATE_LIMITED_BODY,
  RATE_LIMITED_STATUS,
} from "@/lib/rateLimit";
import {
  getCachedRoute,
  ROUTE_EXPIRED_BODY,
  ROUTE_EXPIRED_STATUS,
} from "@/lib/routeCache";

type Poi = { placeId: string; x: number; y: number };
type Body = { routeId: string; pois: Poi[] };

const MAX_POIS = 3;

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "extraTime");
  if (!rate.ok) {
    return NextResponse.json(RATE_LIMITED_BODY, {
      status: RATE_LIMITED_STATUS,
      headers: { "Retry-After": String(rate.retryAfterSec) },
    });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.routeId || !Array.isArray(body.pois) || body.pois.length === 0) {
    return NextResponse.json(
      { error: "E-900", message: "routeId, pois[] required" },
      { status: 400 },
    );
  }

  const route = getCachedRoute(body.routeId);
  if (!route || route.vertexes.length < 2) {
    return NextResponse.json(ROUTE_EXPIRED_BODY, { status: ROUTE_EXPIRED_STATUS });
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
        const detour = extractSummary(resp);
        return {
          placeId: poi.placeId,
          extraSec: Math.max(0, detour.durationSec - route.durationSec),
          extraDistM: Math.max(0, detour.distanceM - route.distanceM),
          approx: false,
        };
      } catch {
        // 실패 시 근사치 유지 플래그만 세우고 나머지는 프론트가 기존 근사값 사용 (FS-4).
        // 일일 예산 초과(QuotaExceededError)도 여기로 흡수된다 — 정밀 시간은 보조
        // 기능이라 화면을 막는 것보다 근사치로 계속 보여주는 편이 낫다.
        return { placeId: poi.placeId, extraSec: null, extraDistM: null, approx: true };
      }
    }),
  );

  return NextResponse.json({ results });
}
