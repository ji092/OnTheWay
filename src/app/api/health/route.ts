import { NextResponse } from "next/server";
import { callCounts } from "@/lib/kakao";

export async function GET() {
  return NextResponse.json({ status: "ok", kakaoCalls: callCounts });
}
