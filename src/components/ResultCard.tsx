import type { Candidate, SortStyle } from "@/lib/types";

/** 그림문자 대신 짧은 글자 배지 — 플랫폼마다 다르게 그려지지 않고 뜻이 분명하다. */
const BADGE: Record<string, string> = { dt: "DT", gas: "주유", gasPremium: "고급", restroom: "WC" };
const SIDE_LABEL: Record<Candidate["side"], string> = {
  SAME: "· 같은 방향",
  OPPOSITE: "△ 반대편(유턴)",
  UNKNOWN: "? 방향 확인 필요",
};

/** 선택한 탐색 방식이 곧 사용자가 보고 싶은 지표 — 해당 값만 강조한다. */
const EMPHASIS: Record<SortStyle, { time: boolean; dist: boolean }> = {
  recommended: { time: true, dist: true },
  distance: { time: false, dist: true },
  time: { time: true, dist: false },
};

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`;
}

export default function ResultCard({
  candidate,
  selected,
  onSelect,
  precise,
  precisionLoading,
  sortStyle,
}: {
  candidate: Candidate;
  selected: boolean;
  onSelect: () => void;
  /** 상위 3개만 채워짐(FS-4). 없으면 근사치 표시. */
  precise?: { extraSec: number; extraDistM: number };
  precisionLoading?: boolean;
  sortStyle: SortStyle;
}) {
  const isApprox = !precise;
  const sec = precise ? precise.extraSec : candidate.approxExtraSec;
  const extraDistM = precise ? precise.extraDistM : candidate.approxExtraDistM;
  const minutes = Math.round(sec / 60);
  const prefix = isApprox ? "약 " : "";

  const emphasis = EMPHASIS[sortStyle];
  const timeValue = precisionLoading
    ? "계산 중…"
    : `+${minutes < 1 ? "1분 미만" : `${minutes}분`}`;
  const distValue = precisionLoading ? "계산 중…" : `+${formatDistance(extraDistM)}`;
  // "약"은 값이 아니라 정확도 표시라 강조에서 빼고 흐리게 둔다.
  const approxMark = precisionLoading || !prefix ? null : <span className="metricApprox">약 </span>;

  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`resultCard${selected ? " resultCardSelected" : ""}`}
      onClick={onSelect}
    >
      <span className="resultBadge">{BADGE[candidate.category ?? ""] ?? "장소"}</span>
      <div className="resultBody">
        <div className="resultName">{candidate.name}</div>
        {candidate.price ? (
          <div className="resultPrice">고급유 {candidate.price.toLocaleString("ko-KR")}원</div>
        ) : null}
        <div className="resultMeta">
          이탈 {candidate.distM}m · {approxMark}
          <span className={emphasis.time ? "metricStrong" : undefined}>{timeValue}</span> ·{" "}
          {approxMark}
          <span className={emphasis.dist ? "metricStrong" : undefined}>{distValue}</span>
        </div>
        <div className="resultSide">{SIDE_LABEL[candidate.side]}</div>
      </div>
    </button>
  );
}
