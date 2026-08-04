import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  RATE_LIMITED_BODY,
  RATE_LIMITED_STATUS,
} from "@/lib/rateLimit";
import { QuotaExceededError, QUOTA_EXCEEDED_BODY, QUOTA_EXCEEDED_STATUS } from "@/lib/quota";
import { searchAlongRoute, searchPremiumGasAlongRoute, type Category } from "@/lib/pipeline";
import { OpinetApiError } from "@/lib/opinet";
import { KakaoApiError } from "@/lib/kakao";
import {
  getCachedRoute,
  getCachedSearch,
  setCachedSearch,
  ROUTE_EXPIRED_BODY,
  ROUTE_EXPIRED_STATUS,
} from "@/lib/routeCache";

type Body = { routeId: string; query: string; category?: Category };

const MAX_QUERY_LENGTH = 50;

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
  // 검색어는 그대로 카카오로 전달되므로 길이를 제한한다.
  if (body.query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: "E-900", message: `query must be ${MAX_QUERY_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  // 좌표가 2개 미만이면 점-선분 거리 자체가 성립하지 않아 전부 걸러진다.
  // 빈 결과로 조용히 넘기지 않고 경로를 다시 받게 한다.
  const route = getCachedRoute(body.routeId);
  if (!route || route.vertexes.length < 2) {
    return NextResponse.json(ROUTE_EXPIRED_BODY, { status: ROUTE_EXPIRED_STATUS });
  }

  // 같은 경로·같은 키워드면 카카오를 다시 때리지 않는다 (카테고리 탭 왕복 대응).
  const cached = getCachedSearch(body.routeId, body.query, body.category);
  if (cached) {
    return NextResponse.json({ candidates: cached, cached: true });
  }

  try {
    // 고급유만 출처가 다르다 — 카카오는 고급휘발유 취급 여부를 모른다.
    const candidates =
      body.category === "gasPremium"
        ? await searchPremiumGasAlongRoute(route.vertexes)
        : await searchAlongRoute(route.vertexes, body.query, body.category);
    setCachedSearch(body.routeId, body.query, candidates, body.category);
    return NextResponse.json({ candidates });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(QUOTA_EXCEEDED_BODY, { status: QUOTA_EXCEEDED_STATUS });
    }
    if (err instanceof KakaoApiError || err instanceof OpinetApiError) {
      return NextResponse.json(
        { error: "E-203", message: "일시적으로 검색이 원활하지 않습니다" },
        { status: 502 },
      );
    }
    // 여기까지 온 건 우리 쪽 버그 — 외부 API 실패로 위장하면 원인을 못 찾는다.
    // 다시 던지면 플랫폼 기본 500이 나가 오류 코드도 로그도 남지 않는다.
    console.error("[/api/search] 예기치 못한 오류", err);
    return NextResponse.json(
      { error: "E-202", message: "검색 중 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
