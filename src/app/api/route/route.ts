import { NextRequest, NextResponse } from "next/server";
import { directions, extractVertexes, KakaoApiError } from "@/lib/kakao";
import { cacheGet, cacheSet, TEN_MIN_MS } from "@/lib/cache";
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

  const cached = cacheGet<{ vertexes: Coord[]; durationSec: number; distanceM: number }>(routeId);
  if (cached) {
    return NextResponse.json({ routeId, ...cached });
  }

  try {
    const resp = await directions(origin.x, origin.y, destination.x, destination.y);
    const { vertexes, durationSec, distanceM } = extractVertexes(resp);
    cacheSet(routeId, { vertexes, durationSec, distanceM }, TEN_MIN_MS);
    return NextResponse.json({ routeId, vertexes, durationSec, distanceM });
  } catch (err) {
    if (err instanceof KakaoApiError) {
      return NextResponse.json(
        { error: "E-103", message: `카카오 길찾기 API 호출 실패: ${err.message}` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "E-102", message: "경로를 찾을 수 없습니다" },
      { status: 422 },
    );
  }
}
