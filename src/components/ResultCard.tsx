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
}: {
  candidate: Candidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const minutes = Math.round(candidate.approxExtraSec / 60);
  return (
    <button className={`resultCard${selected ? " resultCardSelected" : ""}`} onClick={onSelect}>
      <span className="resultIcon">{ICON[candidate.category ?? ""] ?? "📍"}</span>
      <div className="resultBody">
        <div className="resultName">{candidate.name}</div>
        <div className="resultMeta">
          이탈 {candidate.distM}m · +{minutes < 1 ? "1분 미만" : `${minutes}분`} · 🔥 {candidate.score}점
        </div>
        <div className="resultSide">{SIDE_LABEL[candidate.side]}</div>
      </div>
    </button>
  );
}
