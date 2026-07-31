"use client";

/**
 * App Router 에러 바운더리 — 예상 가능한 API 에러(경로 만료, 검색 실패 등)가 아니라
 * 렌더링 중 예상치 못한 예외(버그)를 잡는 마지막 안전망. 비즈니스 에러 처리는
 * StepResults 등 각 화면 안의 에러 상태로 이미 처리하므로, 여기는 그 외의 크래시 전용.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page">
      <div className="errorBoundary">
        <h1 className="brand">On The Way</h1>
        <p className="errorText">예상치 못한 오류가 발생했습니다.</p>
        <p className="errorDetail">{error.message}</p>
        <button className="primaryBtn" onClick={reset}>
          다시 시도
        </button>
      </div>
    </div>
  );
}
