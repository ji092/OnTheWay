import { NextResponse } from "next/server";
import { callCounts } from "@/lib/kakao";
import { cacheSize } from "@/lib/cache";
import { opinetQuotaStatus, quotaStatus } from "@/lib/quota";
import { callCount as opinetCalls } from "@/lib/opinet";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    cacheSize: cacheSize(),
    kakaoCalls: callCounts,
    quota: quotaStatus(),
    opinetCalls,
    opinetQuota: opinetQuotaStatus(),
  });
}
