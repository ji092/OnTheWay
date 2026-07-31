"use client";
import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps } from "@/lib/kakaoMapLoader";
import type { Point } from "@/lib/types";

type MapMarker = Point & { color?: string };

/** 지도 위에 얹었다가 걷어내야 하는 것들(마커·폴리라인·커스텀오버레이)의 공통 최소 인터페이스. */
type Overlay = { setMap: (map: unknown | null) => void };
type MapInstance = { setBounds: (bounds: unknown) => void };

const SEOUL_CITY_HALL = { x: 126.978, y: 37.5665 };
const DEFAULT_PIN_COLOR = "#4f8ef7";

function pinElement(color: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "mapPin";
  el.style.background = color;
  return el;
}

export default function KakaoMap({
  markers = [],
  polyline,
  height = 220,
}: {
  markers?: MapMarker[];
  polyline?: Point[];
  height?: number | string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 지도는 컨테이너당 한 번만 만들고 재사용한다 — 마커가 바뀔 때마다 새로 만들면
  // 이전 인스턴스가 정리되지 않고 쌓인다.
  const mapRef = useRef<{ map: MapInstance; container: HTMLElement } | null>(null);
  const overlaysRef = useRef<Overlay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const clearOverlays = () => {
      for (const overlay of overlaysRef.current) overlay.setMap(null);
      overlaysRef.current = [];
    };

    Promise.resolve()
      .then(() => {
        if (!cancelled) setError(null);
        return loadKakaoMaps();
      })
      .then((kakao) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        const { maps } = kakao;

        const points = polyline && polyline.length > 0 ? polyline : markers;
        const centerPoint = points[0] ?? SEOUL_CITY_HALL;

        // 에러 화면을 거쳐 다시 그려지면 컨테이너 DOM이 새로 생기므로 그때만 재생성.
        if (!mapRef.current || mapRef.current.container !== container) {
          clearOverlays();
          mapRef.current = {
            container,
            map: new maps.Map(container, {
              center: new maps.LatLng(centerPoint.y, centerPoint.x),
              level: 6,
            }),
          };
        }
        const map = mapRef.current.map;

        clearOverlays();
        const bounds = new maps.LatLngBounds();
        let hasBounds = false;

        for (const m of markers) {
          const pos = new maps.LatLng(m.y, m.x);
          const color = m.color ?? DEFAULT_PIN_COLOR;
          // CustomOverlay가 없는 예외적인 SDK 상태에서도 지도는 살아 있어야 하므로 기본 마커로 폴백.
          const overlay = maps.CustomOverlay
            ? new maps.CustomOverlay({ position: pos, content: pinElement(color), yAnchor: 0.5, map })
            : new maps.Marker({ position: pos, map });
          overlaysRef.current.push(overlay);
          bounds.extend(pos);
          hasBounds = true;
        }

        if (polyline && polyline.length > 1) {
          const path = polyline.map((p) => new maps.LatLng(p.y, p.x));
          overlaysRef.current.push(
            new maps.Polyline({
              path,
              strokeWeight: 4,
              strokeColor: "#4f8ef7",
              strokeOpacity: 0.85,
              map,
            }),
          );
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
  }, [JSON.stringify(markers), JSON.stringify(polyline), retryCount]);

  // 언마운트 시 오버레이를 걷어내고 지도 참조를 놓아준다.
  useEffect(() => {
    return () => {
      for (const overlay of overlaysRef.current) overlay.setMap(null);
      overlaysRef.current = [];
      mapRef.current = null;
    };
  }, []);

  if (error) {
    return (
      <div className="mapPlaceholder" style={{ height }}>
        <span>지도를 불러올 수 없습니다 ({error})</span>
        <button className="secondaryBtn" onClick={() => setRetryCount((n) => n + 1)}>
          다시 시도
        </button>
      </div>
    );
  }

  return <div ref={containerRef} className="mapContainer" style={{ height }} />;
}
