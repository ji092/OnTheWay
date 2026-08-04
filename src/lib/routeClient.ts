/**
 * /api/route 호출 클라이언트 (브라우저 전용).
 *
 * 경로를 받아오는 곳이 두 군데다 — 홈에서 처음 탐색할 때, 그리고 결과 화면에서
 * 경로 ID가 만료(E-204)돼 다시 받아올 때. 두 곳이 각자 fetch를 들고 있으면
 * 한쪽만 고치는 일이 생기므로 여기 하나로 모은다.
 */
import type { Place, Point } from "./types";

export type RouteResult = { routeId: string; vertexes: Point[] };

/**
 * 실패하면 서버가 준 메시지를 그대로 담아 throw한다.
 * 경로 없음(422)과 외부 API 실패(502)는 사용자에게 다르게 읽혀야 하는데,
 * 호출부에서 상태 코드를 다시 해석하지 않아도 되도록 메시지를 그대로 올린다.
 */
export async function requestRoute(origin: Place, destination: Place): Promise<RouteResult> {
  let res: Response;
  try {
    res = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: { x: origin.x, y: origin.y },
        destination: { x: destination.x, y: destination.y },
      }),
    });
  } catch {
    throw new Error("네트워크 연결을 확인해주세요");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message ?? "경로를 찾을 수 없습니다");
  }
  if (!data?.routeId || !Array.isArray(data.vertexes)) {
    throw new Error("경로 응답 형식이 올바르지 않습니다");
  }
  return { routeId: data.routeId, vertexes: data.vertexes };
}
