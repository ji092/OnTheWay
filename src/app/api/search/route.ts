import { NextRequest, NextResponse } from "next/server";
import { cacheGet } from "@/lib/cache";
import { searchAlongRoute, type Category } from "@/lib/pipeline";
import { KakaoApiError } from "@/lib/kakao";
import type { Point } from "@/lib/geo";

type Body = { routeId: string; query: string; category?: Category };
type CachedRoute = { vertexes: Point[]; durationSec: number; distanceM: number };

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.routeId || !body?.query) {
    return NextResponse.json(
      { error: "E-900", message: "routeId, query required" },
      { status: 400 },
    );
  }

  const route = cacheGet<CachedRoute>(body.routeId);
  if (!route) {
    return NextResponse.json(
      { error: "E-204", message: "경로 정보가 만료되었습니다. /api/route를 다시 호출하세요." },
      { status: 410 },
    );
  }

  try {
    const candidates = await searchAlongRoute(route.vertexes, body.query, body.category);
    return NextResponse.json({ candidates });
  } catch (err) {
    if (err instanceof KakaoApiError) {
      return NextResponse.json(
        { error: "E-203", message: "일시적으로 검색이 원활하지 않습니다" },
        { status: 502 },
      );
    }
    throw err;
  }
}
