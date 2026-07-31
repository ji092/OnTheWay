import { NextRequest, NextResponse } from "next/server";
import { directions, extractVertexes, KakaoApiError, NoRouteError } from "@/lib/kakao";
import { getCachedRoute, setCachedRoute } from "@/lib/routeCache";
import {
  checkRateLimit,
  RATE_LIMITED_BODY,
  RATE_LIMITED_STATUS,
} from "@/lib/rateLimit";
import { QuotaExceededError, QUOTA_EXCEEDED_BODY, QUOTA_EXCEEDED_STATUS } from "@/lib/quota";

import { createHash } from "crypto";

type Coord = { x: number; y: number };
type Body = { origin: Coord; destination: Coord };

function isCoord(v: unknown): v is Coord {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Coord).x === "number" &&
    typeof (v as Coord).y === "number"
  );
}

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "route");
  if (!rate.ok) {
    return NextResponse.json(RATE_LIMITED_BODY, {
      status: RATE_LIMITED_STATUS,
      headers: { "Retry-After": String(rate.retryAfterSec) },
    });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !isCoord(body.origin) || !isCoord(body.destination)) {
    return NextResponse.json(
      { error: "E-900", message: "origin/destination {x,y} required" },
      { status: 400 },
    );
  }
  const { origin, destination } = body;

  const routeId = createHash("sha1")
    .update(`${origin.x},${origin.y}->${destination.x},${destination.y}`)
    .digest("hex")
    .slice(0, 16);

  const cached = getCachedRoute(routeId);
  if (cached) {
    return NextResponse.json({ routeId, ...cached });
  }

  try {
    const resp = await directions(origin.x, origin.y, destination.x, destination.y);
    const { vertexes, durationSec, distanceM } = extractVertexes(resp);
    setCachedRoute(routeId, { vertexes, durationSec, distanceM });
    return NextResponse.json({ routeId, vertexes, durationSec, distanceM });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(QUOTA_EXCEEDED_BODY, { status: QUOTA_EXCEEDED_STATUS });
    }
    if (err instanceof KakaoApiError) {
      return NextResponse.json(
        { error: "E-103", message: `카카오 길찾기 API 호출 실패: ${err.message}` },
        { status: 502 },
      );
    }
    if (err instanceof NoRouteError) {
      return NextResponse.json(
        { error: "E-102", message: "경로를 찾을 수 없습니다" },
        { status: 422 },
      );
    }
    // 여기까지 온 건 우리 쪽 버그 — "경로 문제"로 위장하면 원인을 못 찾는다.
    console.error("[/api/route] 예기치 못한 오류", err);
    return NextResponse.json(
      { error: "E-101", message: "경로 처리 중 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
