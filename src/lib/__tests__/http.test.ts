import { describe, it, expect, vi } from "vitest";
import { withRetry, TimeoutError, isNetworkError, fetchWithTimeout } from "../http";

const alwaysRetry = { isRetriable: () => true };

describe("withRetry", () => {
  it("성공하면 재시도하지 않는다", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn, alwaysRetry)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("일시적 실패는 재시도해서 살린다", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TimeoutError(100))
      .mockResolvedValue("ok");
    await expect(withRetry(fn, alwaysRetry)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  // 여기서 넓게 잡으면 우리 코드 버그까지 재시도하면서 쿼터를 3배로 태운다.
  it("재시도 대상이 아니면 한 번만 호출하고 그대로 던진다", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("잘못된 요청"));
    await expect(withRetry(fn, { isRetriable: () => false })).rejects.toThrow("잘못된 요청");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("최대 시도 횟수를 넘기지 않는다", async () => {
    const fn = vi.fn().mockRejectedValue(new TimeoutError(100));
    await expect(withRetry(fn, { ...alwaysRetry, maxAttempts: 3 })).rejects.toThrow(TimeoutError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  // 예산이 없으면 백오프를 기다리지 않고 포기해야 서버리스 실행 한도를 안 넘긴다.
  it("남은 예산으로 다음 시도를 못 하면 재시도하지 않는다", async () => {
    const fn = vi.fn().mockRejectedValue(new TimeoutError(100));
    await expect(withRetry(fn, { ...alwaysRetry, budgetMs: 0 })).rejects.toThrow(TimeoutError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("fetchWithTimeout", () => {
  it("응답이 늦으면 TimeoutError로 바꿔 던진다", async () => {
    const original = globalThis.fetch;
    // 어떤 신호로도 끝나지 않는 요청 — 타임아웃만이 이걸 끊을 수 있다.
    globalThis.fetch = vi.fn((_url, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "TimeoutError";
          reject(err);
        });
      });
    }) as unknown as typeof fetch;

    try {
      await expect(fetchWithTimeout("https://example.test", {}, 20)).rejects.toThrow(TimeoutError);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("isNetworkError", () => {
  it("fetch의 네트워크 실패(TypeError)만 네트워크 오류로 본다", () => {
    expect(isNetworkError(new TypeError("fetch failed"))).toBe(true);
    expect(isNetworkError(new Error("그 외"))).toBe(false);
  });
});
