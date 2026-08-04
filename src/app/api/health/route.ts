import { NextRequest, NextResponse } from "next/server";
import { callCounts } from "@/lib/kakao";
import { cacheSize } from "@/lib/cache";
import { opinetQuotaStatus, quotaStatus } from "@/lib/quota";
import { callCount as opinetCalls } from "@/lib/opinet";
import { checkRateLimit, RATE_LIMITED_BODY, RATE_LIMITED_STATUS } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  // 외부 API를 부르지 않으니 쿼터는 안 나가지만, 예산 잔량과 호출 수가 그대로 보이는
  // 엔드포인트다. 인증을 붙일 값어치는 아니어서 호출 빈도만 제한한다.
  const rate = checkRateLimit(req, "health");
  if (!rate.ok) {
    return NextResponse.json(RATE_LIMITED_BODY, {
      status: RATE_LIMITED_STATUS,
      headers: { "Retry-After": String(rate.retryAfterSec) },
    });
  }

  return NextResponse.json({
    status: "ok",
    cacheSize: cacheSize(),
    kakaoCalls: callCounts,
    quota: quotaStatus(),
    opinetCalls,
    opinetQuota: opinetQuotaStatus(),
  });
}
