import { NextRequest, NextResponse } from "next/server";
import { searchPlaceByName } from "@/lib/kakao";

type KakaoDoc = { id: string; place_name: string; x: string; y: string; address_name?: string };

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ places: [] });

  const resp = (await searchPlaceByName(q)) as { documents: KakaoDoc[] };
  const places = resp.documents.slice(0, 8).map((d) => ({
    name: d.place_name,
    address: d.address_name ?? "",
    x: parseFloat(d.x),
    y: parseFloat(d.y),
  }));
  return NextResponse.json({ places });
}
