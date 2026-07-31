"use client";
import KakaoMap from "./KakaoMap";
import type { Place, Point, SortStyle } from "@/lib/types";

type Option = {
  value: SortStyle | "transit";
  icon: string;
  title: string;
  desc: string;
  disabled?: boolean;
};

const OPTIONS: Option[] = [
  { value: "recommended", icon: "👍", title: "추천 경로", desc: "이탈거리·시간·방향을 종합 고려한 추천" },
  { value: "distance", icon: "↝", title: "최소 거리", desc: "추가 주행거리가 가장 적은 순서로 정렬" },
  { value: "time", icon: "⏱", title: "최단 시간", desc: "추가 소요시간이 가장 적은 순서로 정렬" },
  // 카카오·네이버 모두 대중교통 길찾기 REST API를 제공하지 않아 보류 상태.
  { value: "transit", icon: "🚌", title: "대중교통", desc: "서비스 준비 중", disabled: true },
];

export default function StepStyle({
  origin,
  destination,
  vertexes,
  onSelect,
}: {
  origin: Place;
  destination: Place;
  vertexes: Point[];
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
          <button
            key={opt.value}
            className="styleCard"
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onSelect(opt.value as SortStyle)}
          >
            <span className="styleIcon">{opt.icon}</span>
            <span className="styleTitle">{opt.title}</span>
            <span className="styleDesc">{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
