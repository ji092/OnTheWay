/**
 * 오피넷(한국석유공사) 유가정보 API 클라이언트 — 서버 전용.
 * 키는 서버 전용 환경변수(OPINET_API_KEY)로만 주입. 절대 클라이언트에 노출하지 않는다.
 *
 * 카카오 로컬 검색으로는 "고급휘발유를 파는가"를 알 수 없다(장소명/카테고리만 매칭).
 * 오피넷 반경 검색은 제품코드로 필터링되므로 고급유 취급 주유소만 정확히 받아올 수 있고,
 * 판매가격까지 함께 온다.
 */
import { consumeOpinetQuota } from "./quota";
import { wgs84ToKatec, katecToWgs84, isInKorea } from "./coord";
import type { Point } from "./types";

const AROUND_URL = "https://www.opinet.co.kr/api/aroundAll.do";

/** 제품구분 코드 (API 가이드 기준). */
export const PRODUCT = {
  gasoline: "B027",
  premiumGasoline: "B034",
  diesel: "D047",
} as const;

/** 반경 상한은 API 규격상 5,000m. */
export const MAX_RADIUS_M = 5000;

export class OpinetApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const callCount = { around: 0 };

export type Station = {
  /** 오피넷 주유소 코드 */
  id: string;
  name: string;
  /** 상표 코드 (SKE, GSC, HDO, SOL, RTE, ...) */
  brand: string;
  /** 해당 제품의 판매가격(원/L) */
  price: number;
  /** WGS84로 변환된 좌표 */
  x: number;
  y: number;
};

type RawStation = {
  UNI_ID?: string;
  OS_NM?: string;
  POLL_DIV_CD?: string;
  PRICE?: number | string;
  GIS_X_COOR?: number | string;
  GIS_Y_COOR?: number | string;
};

/** 오피넷 JSON 응답은 { RESULT: { OIL: [...] } } 형태. */
type AroundResponse = { RESULT?: { OIL?: RawStation[] } };

function apiKey(): string {
  const key = process.env.OPINET_API_KEY;
  if (!key) throw new Error("OPINET_API_KEY not set");
  return key;
}

const num = (v: unknown): number => Number(typeof v === "string" ? v.trim() : v);

/**
 * 응답 1건을 Station으로 변환. 좌표/가격이 성립하지 않으면 null —
 * 한 건이 이상하다고 전체 검색을 실패시키지 않는다.
 */
export function toStation(raw: RawStation): Station | null {
  const id = raw.UNI_ID?.trim();
  const katecX = num(raw.GIS_X_COOR);
  const katecY = num(raw.GIS_Y_COOR);
  const price = num(raw.PRICE);
  if (!id || !Number.isFinite(katecX) || !Number.isFinite(katecY)) return null;

  const wgs = katecToWgs84({ x: katecX, y: katecY });
  if (!isInKorea(wgs)) return null; // 좌표계를 잘못 해석한 경우를 조용히 흘리지 않는다

  return {
    id,
    name: raw.OS_NM?.trim() || "이름 없는 주유소",
    brand: raw.POLL_DIV_CD?.trim() ?? "ETC",
    price: Number.isFinite(price) ? price : 0,
    x: wgs.x,
    y: wgs.y,
  };
}

/**
 * 특정 지점 반경 내에서 해당 제품을 파는 주유소 목록.
 * 입력은 WGS84 경위도이며, KATEC 변환은 이 함수 안에서 처리한다.
 */
export async function stationsAround(
  center: Point,
  radiusM: number,
  product: string = PRODUCT.premiumGasoline,
): Promise<Station[]> {
  const katec = wgs84ToKatec(center);
  const params = new URLSearchParams({
    code: apiKey(),
    out: "json",
    x: String(katec.x),
    y: String(katec.y),
    radius: String(Math.min(Math.round(radiusM), MAX_RADIUS_M)),
    prodcd: product,
    sort: "2", // 거리순
  });

  consumeOpinetQuota();
  callCount.around++;

  const res = await fetch(`${AROUND_URL}?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new OpinetApiError(res.status, `${res.status} ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as AroundResponse;
  const raw = data.RESULT?.OIL ?? [];
  return raw.map(toStation).filter((s): s is Station => s !== null);
}
