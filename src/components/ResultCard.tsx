import type { Candidate } from "@/lib/types";

const ICON: Record<string, string> = { dt: "🚗", gas: "⛽", restroom: "🚻" };
const SIDE_LABEL: Record<Candidate["side"], string> = {
  SAME: "✓ 같은 방향",
  OPPOSITE: "⚠ 반대편(유턴)",
  UNKNOWN: "? 방향 확인 필요",
};

export default function ResultCard({
  candidate,
  selected,
  onSelect,
  preciseExtraSec,
  precisionLoading,
}: {
  candidate: Candidate;
  selected: boolean;
  onSelect: () => void;
  /** 상위 3개만 채워짐(FS-4). undefined면 근사치 표시. */
  preciseExtraSec?: number | null;
  precisionLoading?: boolean;
}) {
  const isApprox = preciseExtraSec === undefined || preciseExtraSec === null;
  const sec = isApprox ? candidate.approxExtraSec : preciseExtraSec;
  const minutes = Math.round(sec / 60);
  const timeLabel = precisionLoading
    ? "계산 중…"
    : `${isApprox ? "약 " : ""}+${minutes < 1 ? "1분 미만" : `${minutes}분`}`;

  return (
    <button className={`resultCard${selected ? " resultCardSelected" : ""}`} onClick={onSelect}>
      <span className="resultIcon">{ICON[candidate.category ?? ""] ?? "📍"}</span>
      <div className="resultBody">
        <div className="resultName">{candidate.name}</div>
        <div className="resultMeta">
          이탈 {candidate.distM}m · {timeLabel} · 🔥 {candidate.score}점
        </div>
        <div className="resultSide">{SIDE_LABEL[candidate.side]}</div>
      </div>
    </button>
  );
}
