"use client";
import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps } from "@/lib/kakaoMapLoader";

export type MapMarker = { x: number; y: number; color?: string };
export type MapPoint = { x: number; y: number };

export default function KakaoMap({
  markers = [],
  polyline,
  height = 220,
}: {
  markers?: MapMarker[];
  polyline?: MapPoint[];
  height?: number | string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !containerRef.current) return;
        const { maps } = kakao;

        const points = polyline && polyline.length > 0 ? polyline : markers;
        const centerPoint = points[0] ?? { x: 126.978, y: 37.5665 };
        const center = new maps.LatLng(centerPoint.y, centerPoint.x);
        const map = new maps.Map(containerRef.current, { center, level: 6 });

        const bounds = new maps.LatLngBounds();
        let hasBounds = false;

        for (const m of markers) {
          const pos = new maps.LatLng(m.y, m.x);
          new maps.Marker({ position: pos, map });
          bounds.extend(pos);
          hasBounds = true;
        }

        if (polyline && polyline.length > 1) {
          const path = polyline.map((p) => new maps.LatLng(p.y, p.x));
          new maps.Polyline({ path, strokeWeight: 4, strokeColor: "#4f8ef7", strokeOpacity: 0.85, map });
          for (const p of path) {
            bounds.extend(p);
            hasBounds = true;
          }
        }

        if (hasBounds) map.setBounds(bounds);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
    // markers/polyline은 매 렌더 새 배열 참조라 값 기반 키로 재실행 여부를 제한한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(markers), JSON.stringify(polyline)]);

  if (error) {
    return (
      <div className="mapPlaceholder" style={{ height }}>
        <span>지도를 불러올 수 없습니다 ({error})</span>
      </div>
    );
  }

  return <div ref={containerRef} className="mapContainer" style={{ height }} />;
}
