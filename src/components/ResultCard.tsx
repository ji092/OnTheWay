import type { Candidate, SortStyle } from "@/lib/types";

const ICON: Record<string, string> = { dt: "🚗", gas: "⛽", restroom: "🚻" };
const SIDE_LABEL: Record<Candidate["side"], string> = {
  SAME: "✓ 같은 방향",
  OPPOSITE: "⚠ 반대편(유턴)",
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
  const timeLabel = precisionLoading
    ? "계산 중…"
    : `${prefix}+${minutes < 1 ? "1분 미만" : `${minutes}분`}`;
  const distLabel = precisionLoading ? "계산 중…" : `${prefix}+${formatDistance(extraDistM)}`;

  return (
    <button className={`resultCard${selected ? " resultCardSelected" : ""}`} onClick={onSelect}>
      <span className="resultIcon">{ICON[candidate.category ?? ""] ?? "📍"}</span>
      <div className="resultBody">
        <div className="resultName">{candidate.name}</div>
        <div className="resultMeta">
          이탈 {candidate.distM}m ·{" "}
          <span className={emphasis.time ? "metricStrong" : undefined}>{timeLabel}</span> ·{" "}
          <span className={emphasis.dist ? "metricStrong" : undefined}>{distLabel}</span>
        </div>
        <div className="resultSide">{SIDE_LABEL[candidate.side]}</div>
      </div>
    </button>
  );
}
