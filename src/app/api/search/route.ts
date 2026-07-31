import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  RATE_LIMITED_BODY,
  RATE_LIMITED_STATUS,
} from "@/lib/rateLimit";
import { QuotaExceededError, QUOTA_EXCEEDED_BODY, QUOTA_EXCEEDED_STATUS } from "@/lib/quota";
import { searchAlongRoute, type Category } from "@/lib/pipeline";
import { KakaoApiError } from "@/lib/kakao";
import {
  getCachedRoute,
  getCachedSearch,
  setCachedSearch,
  ROUTE_EXPIRED_BODY,
  ROUTE_EXPIRED_STATUS,
} from "@/lib/routeCache";

type Body = { routeId: string; query: string; category?: Category };

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "search");
  if (!rate.ok) {
    return NextResponse.json(RATE_LIMITED_BODY, {
      status: RATE_LIMITED_STATUS,
      headers: { "Retry-After": String(rate.retryAfterSec) },
    });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.routeId || !body?.query) {
    return NextResponse.json(
      { error: "E-900", message: "routeId, query required" },
      { status: 400 },
    );
  }

  const route = getCachedRoute(body.routeId);
  if (!route) {
    return NextResponse.json(ROUTE_EXPIRED_BODY, { status: ROUTE_EXPIRED_STATUS });
  }

  // 같은 경로·같은 키워드면 카카오를 다시 때리지 않는다 (카테고리 탭 왕복 대응).
  const cached = getCachedSearch(body.routeId, body.query);
  if (cached) {
    return NextResponse.json({ candidates: cached, cached: true });
  }

  try {
    const candidates = await searchAlongRoute(route.vertexes, body.query, body.category);
    setCachedSearch(body.routeId, body.query, candidates);
    return NextResponse.json({ candidates });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(QUOTA_EXCEEDED_BODY, { status: QUOTA_EXCEEDED_STATUS });
    }
    if (err instanceof KakaoApiError) {
      return NextResponse.json(
        { error: "E-203", message: "일시적으로 검색이 원활하지 않습니다" },
        { status: 502 },
      );
    }
    throw err;
  }
}
