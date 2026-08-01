/**
 * 외부 API 일일 호출 예산 (서킷 브레이커).
 *
 * 레이트리밋이 "한 사람이 얼마나 자주"를 막는다면, 이쪽은 "오늘 전체로 얼마나"를 막는다.
 * 쿼터가 실제로 바닥나서 앱이 통째로 죽는 것보다, 우리가 먼저 멈추고 사정을 설명하는 편이 낫다.
 * 인메모리이므로 서버리스에서는 인스턴스별 예산이 된다(SPEC §10-D6).
 */

export class QuotaExceededError extends Error {
  constructor(public provider: string) {
    super(`${provider} daily call budget exceeded`);
  }
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 외부 API 쿼터가 KST 자정 기준으로 초기화되므로 같은 기준으로 센다. */
function kstDay(now: number): number {
  return Math.floor((now + KST_OFFSET_MS) / 86_400_000);
}

function createDailyBudget(provider: string, envVar: string, fallback: number) {
  let day = kstDay(Date.now());
  let used = 0;

  const budget = (): number => {
    const configured = Number(process.env[envVar]);
    return Number.isFinite(configured) && configured > 0 ? configured : fallback;
  };

  return {
    /** 외부 API를 호출하기 직전에 1회분을 차감한다. 예산 초과면 호출 자체를 하지 않는다. */
    consume(now = Date.now()): void {
      const today = kstDay(now);
      if (today !== day) {
        day = today;
        used = 0;
      }
      if (used >= budget()) throw new QuotaExceededError(provider);
      used++;
    },
    status(now = Date.now()) {
      const today = kstDay(now);
      const resetsAt = new Date((today + 1) * 86_400_000 - KST_OFFSET_MS);
      return {
        used: today === day ? used : 0,
        budget: budget(),
        resetsAtKst: resetsAt.toISOString(),
      };
    },
    /** 테스트용 — 카운터를 비운다. */
    reset(): void {
      day = kstDay(Date.now());
      used = 0;
    },
  };
}

/**
 * 카카오: 같은 앱 키를 다른 프로젝트와 나눠 쓰고 있어 이 앱은 하루 500회만 가져간다.
 * 콘솔 쿼터를 다 쓰는 값이 아니라 "이 앱에 할당한 몫"이다.
 */
const kakao = createDailyBudget("kakao", "KAKAO_DAILY_BUDGET", 500);

/** 오피넷: 무료 API 한도가 1,500회/일이라 여유를 두고 1,200회로 잡는다. */
const opinet = createDailyBudget("opinet", "OPINET_DAILY_BUDGET", 1200);

export const consumeQuota = kakao.consume;
export const quotaStatus = kakao.status;
export const resetQuota = kakao.reset;

export const consumeOpinetQuota = opinet.consume;
export const opinetQuotaStatus = opinet.status;
export const resetOpinetQuota = opinet.reset;

export const QUOTA_EXCEEDED_BODY = {
  error: "E-902",
  message: "오늘의 데모 사용 한도를 초과했습니다. 내일 다시 이용해주세요.",
} as const;
export const QUOTA_EXCEEDED_STATUS = 503;
