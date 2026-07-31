import { describe, it, expect, vi, afterEach } from "vitest";
import { cacheGet, cacheSet, cacheSize } from "../cache";

afterEach(() => {
  vi.useRealTimers();
});

describe("인메모리 TTL 캐시", () => {
  it("TTL이 지나면 조회되지 않는다", () => {
    vi.useFakeTimers();
    cacheSet("a", 1, 1000);
    expect(cacheGet("a")).toBe(1);
    vi.advanceTimersByTime(1001);
    expect(cacheGet("a")).toBeUndefined();
  });

  // 다시 조회되지 않는 키는 cacheGet만으로는 영원히 남는다 — cacheSet의 sweep이 유일한 청소 경로.
  it("새로 저장할 때 만료된 항목을 걷어낸다 (조회 없이도)", () => {
    vi.useFakeTimers();
    const before = cacheSize();
    cacheSet("잊힌키", "값", 1000);
    expect(cacheSize()).toBe(before + 1);

    vi.advanceTimersByTime(1001);
    cacheSet("새키", "값", 1000);

    // 만료된 "잊힌키"는 사라지고 "새키"만 남아 총량이 유지된다.
    expect(cacheSize()).toBe(before + 1);
    expect(cacheGet("잊힌키")).toBeUndefined();
    expect(cacheGet("새키")).toBe("값");
  });
});
