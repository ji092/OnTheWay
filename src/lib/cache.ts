/**
 * 프로세스 인메모리 TTL 캐시 — 카카오 유래 응답 전용. (SPEC §10-D1, §0)
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

/**
 * 만료 항목 일괄 정리. cacheGet은 "다시 조회된" 키만 지우므로, 한 번 저장하고
 * 잊힌 routeId는 그것만으로는 영원히 남는다. 항목 수가 적어(경로 단위) O(n) 순회로 충분.
 */
function sweep(now: number): void {
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  const now = Date.now();
  sweep(now);
  store.set(key, { value, expiresAt: now + ttlMs });
}

/** 진단·테스트용 — 만료 항목이 실제로 걷혔는지 확인할 수 있는 유일한 관측점. */
export function cacheSize(): number {
  return store.size;
}

export const TEN_MIN_MS = 10 * 60 * 1000;
