import { NextResponse } from "next/server";
import { callCounts } from "@/lib/kakao";
import { quotaStatus } from "@/lib/quota";

export async function GET() {
  return NextResponse.json({ status: "ok", kakaoCalls: callCounts, quota: quotaStatus() });
}
