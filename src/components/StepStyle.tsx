"use client";
import KakaoMap from "./KakaoMap";
import type { Place, SortStyle } from "@/lib/types";

const OPTIONS: { value: SortStyle; icon: string; title: string; desc: string }[] = [
  { value: "distance", icon: "↝", title: "거리 우선", desc: "경로 이탈이 가장 적은 순서로 정렬" },
  { value: "time", icon: "⏱", title: "시간 우선", desc: "추가 소요 시간이 가장 적은 순서로 정렬" },
  { value: "recommended", icon: "👍", title: "추천 경로", desc: "이탈거리·시간·방향을 종합 고려한 추천" },
];

export default function StepStyle({
  origin,
  destination,
  vertexes,
  onSelect,
}: {
  origin: Place;
  destination: Place;
  vertexes: { x: number; y: number }[];
  onSelect: (style: SortStyle) => void;
}) {
  return (
    <div className="screen">
      <KakaoMap
        height={140}
        markers={[
          { x: origin.x, y: origin.y, color: "#4f8ef7" },
          { x: destination.x, y: destination.y, color: "#222" },
        ]}
        polyline={vertexes}
      />
      <h2 className="sectionTitle">경로 탐색 방식</h2>
      <p className="sectionSub">원하는 정렬 스타일을 선택해주세요</p>
      <div className="styleGrid">
        {OPTIONS.map((opt) => (
          <button key={opt.value} className="styleCard" onClick={() => onSelect(opt.value)}>
            <span className="styleIcon">{opt.icon}</span>
            <span className="styleTitle">{opt.title}</span>
            <span className="styleDesc">{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
