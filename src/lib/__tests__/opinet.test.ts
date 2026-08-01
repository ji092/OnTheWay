import { describe, it, expect } from "vitest";
import { toStation } from "../opinet";

/** 오피넷 aroundAll.do 응답 1건의 형태 (API 가이드 반환값 기준). */
const RAW = {
  UNI_ID: "A0019745",
  POLL_DIV_CD: "GSC",
  OS_NM: "역삼주유소",
  PRICE: 1890,
  DISTANCE: 320,
  GIS_X_COOR: 314681.8,
  GIS_Y_COOR: 544837,
};

describe("오피넷 응답 → Station 변환", () => {
  it("KATEC 좌표를 경위도로 바꿔 담는다", () => {
    const station = toStation(RAW)!;

    expect(station.id).toBe("A0019745");
    expect(station.name).toBe("역삼주유소");
    expect(station.brand).toBe("GSC");
    expect(station.price).toBe(1890);
    expect(station.x).toBeCloseTo(127.03, 1);
    expect(station.y).toBeCloseTo(37.5, 1);
  });

  // 오피넷은 XML/JSON 모두 지원해서 숫자가 문자열로 오는 경우가 있다.
  it("문자열로 온 숫자도 처리한다", () => {
    const station = toStation({
      ...RAW,
      PRICE: "1890",
      GIS_X_COOR: "314681.8",
      GIS_Y_COOR: "544837",
    })!;

    expect(station.price).toBe(1890);
    expect(station.x).toBeCloseTo(127.03, 1);
  });

  it("좌표가 없으면 버린다 — 경로 이탈거리를 계산할 수 없으므로", () => {
    expect(toStation({ ...RAW, GIS_X_COOR: undefined })).toBeNull();
    expect(toStation({ ...RAW, GIS_Y_COOR: "" })).toBeNull();
  });

  // KATEC을 그대로 경위도로 해석하면 한반도 밖으로 튄다 — 조용히 흘리면 안 된다.
  it("변환 결과가 한반도 밖이면 버린다", () => {
    expect(toStation({ ...RAW, GIS_X_COOR: 99_999_999, GIS_Y_COOR: 99_999_999 })).toBeNull();
  });

  it("상호가 비어도 후보는 살린다", () => {
    expect(toStation({ ...RAW, OS_NM: "" })?.name).toBe("이름 없는 주유소");
  });
});
