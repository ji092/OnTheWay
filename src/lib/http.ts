/**
 * 외부 API 호출 공통 정책 — 타임아웃 / 재시도 / 예산.
 *
 * 세 값이 따로 놀면 최악의 경우가 통제되지 않는다. 시도별 타임아웃만 걸면
 * (타임아웃 x 시도 수 + 백오프)만큼 매달릴 수 있고, 서버리스 함수 실행 한도를
 * 넘겨 플랫폼에 끊기면 사용자는 원인을 알 수 없는 오류만 본다.
 * 그래서 "작업 전체 예산"을 두고, 남은 시간 안에 끝낼 수 없는 재시도는 하지 않는다.
 */

/** 응답이 오지 않아 우리가 끊은 경우. 재시도 대상으로 분류한다. */
export class TimeoutError extends Error {
  constructor(public timeoutMs: number) {
    super(`request timed out after ${timeoutMs}ms`);
  }
}

export const TIMEOUT = {
  /** 지역 검색·길찾기 — 정상 응답은 1초 내외 */
  standard: 3500,
  /** 경유지 길찾기·유가 정보 — 상대적으로 느림 */
  slow: 5000,
} as const;

/** 한 번의 외부 호출 작업(재시도 포함)이 쓸 수 있는 총 시간. */
export const OPERATION_BUDGET_MS = 7000;

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;

/**
 * 타임아웃이 걸린 fetch. AbortSignal.timeout이 끊으면 AbortError가 나는데,
 * 호출부가 "네트워크 실패"와 구분할 수 있도록 TimeoutError로 바꿔 던진다.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new TimeoutError(timeoutMs);
    }
    throw err;
  }
}

export type RetryOptions = {
  /** 이 오류를 다시 시도할 가치가 있는가. 명시하지 않으면 아무것도 재시도하지 않는다. */
  isRetriable: (err: unknown) => boolean;
  budgetMs?: number;
  maxAttempts?: number;
};

/**
 * 지수 백오프 재시도. 예산이 남지 않으면 재시도하지 않고 마지막 오류를 그대로 던진다.
 * 재시도 여부 판단은 호출부가 넘긴 isRetriable에만 맡긴다 — 여기서 넓게 잡으면
 * 우리 코드의 버그까지 재시도하면서 쿼터를 3배로 태운다.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const budgetMs = opts.budgetMs ?? OPERATION_BUDGET_MS;
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const startedAt = Date.now();
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !opts.isRetriable(err)) throw err;

      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      const elapsed = Date.now() - startedAt;
      // 다음 시도가 예산 안에 들어갈 수 없으면 기다리지 않고 포기한다.
      if (elapsed + delay >= budgetMs) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

/**
 * fetch가 네트워크 단계에서 실패하면 TypeError를 던진다(DNS 실패, 연결 끊김 등).
 * 우리 코드의 TypeError까지 같이 잡히는 한계가 있지만, 그 경우 재시도해도
 * 같은 지점에서 같은 오류가 나므로 쿼터 손해는 최대 3회로 제한된다.
 */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}
