import { NextRequest, NextResponse } from "next/server";
import { KakaoApiError, searchPlaceByName } from "@/lib/kakao";
import { checkRateLimit, RATE_LIMITED_BODY, RATE_LIMITED_STATUS } from "@/lib/rateLimit";
import { QuotaExceededError, QUOTA_EXCEEDED_BODY, QUOTA_EXCEEDED_STATUS } from "@/lib/quota";

type KakaoDoc = { id: string; place_name: string; x: string; y: string; address_name?: string };

export async function GET(req: NextRequest) {
  const rate = checkRateLimit(req, "placeSearch");
  if (!rate.ok) {
    return NextResponse.json(RATE_LIMITED_BODY, {
      status: RATE_LIMITED_STATUS,
      headers: { "Retry-After": String(rate.retryAfterSec) },
    });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ places: [] });

  try {
    const resp = (await searchPlaceByName(q)) as { documents: KakaoDoc[] };
    const places = resp.documents.slice(0, 8).map((d) => ({
      name: d.place_name,
      address: d.address_name ?? "",
      x: parseFloat(d.x),
      y: parseFloat(d.y),
    }));
    return NextResponse.json({ places });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(QUOTA_EXCEEDED_BODY, { status: QUOTA_EXCEEDED_STATUS });
    }
    if (err instanceof KakaoApiError) {
      return NextResponse.json(
        { error: "E-201", message: "일시적으로 장소 검색이 원활하지 않습니다" },
        { status: 502 },
      );
    }
    // 자동완성은 보조 기능이라 프론트가 조용히 무시한다 — 원인은 서버 로그에만 남긴다.
    console.error("[/api/place-search] 예기치 못한 오류", err);
    return NextResponse.json(
      { error: "E-202", message: "장소 검색 중 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
