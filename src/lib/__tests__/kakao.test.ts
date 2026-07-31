import { describe, it, expect } from "vitest";
import { extractSummary, NoRouteError } from "../kakao";

/** 경유지 응답에서 소요시간뿐 아니라 거리도 뽑아야 카드의 "+325m"를 만들 수 있다. */
describe("extractSummary (경유지 길찾기 응답 파싱)", () => {
  it("정상 응답에서 duration/distance를 반올림해 반환", () => {
    const resp = {
      routes: [{ result_code: 0, summary: { duration: 1234.6, distance: 8765.4 } }],
    };
    expect(extractSummary(resp)).toEqual({ durationSec: 1235, distanceM: 8765 });
  });

  // /api/route가 "경로 없음"(422)과 내부 버그(500)를 구분하려면 이 타입이 유지돼야 한다.
  it("result_code가 0이 아니면 카카오 메시지를 담아 NoRouteError", () => {
    const resp = {
      routes: [{ result_code: 104, result_msg: "출발지와 도착지가 5m 이내", summary: {} }],
    };
    expect(() => extractSummary(resp)).toThrow(NoRouteError);
    expect(() => extractSummary(resp)).toThrow("출발지와 도착지가 5m 이내");
  });

  it("routes가 비면 NoRouteError", () => {
    expect(() => extractSummary({ routes: [] })).toThrow(NoRouteError);
  });

  // distance 누락 시 조용히 NaN을 흘리면 카드에 "+NaNm"이 찍힌다 — 근사치 폴백으로 넘겨야 함.
  it("summary에 distance가 없으면 throw (근사치 폴백 유도)", () => {
    const resp = { routes: [{ result_code: 0, summary: { duration: 100 } }] };
    expect(() => extractSummary(resp)).toThrow("summary missing");
    // 경로는 있는데 응답이 이상한 것이므로 "경로 없음"으로 분류되면 안 된다.
    expect(() => extractSummary(resp)).not.toThrow(NoRouteError);
  });
});
