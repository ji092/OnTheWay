"use client";
import { useState } from "react";
import PlaceInput from "./PlaceInput";
import KakaoMap from "./KakaoMap";
import type { Place } from "@/lib/types";

export default function StepHome({
  onRouteFound,
}: {
  onRouteFound: (
    origin: Place,
    destination: Place,
    routeId: string,
    vertexes: { x: number; y: number }[],
  ) => void;
}) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function swap() {
    const o = origin;
    setOrigin(destination);
    setDestination(o);
  }

  async function searchRoute() {
    if (!origin || !destination) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { x: origin.x, y: origin.y },
          destination: { x: destination.x, y: destination.y },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "경로를 찾을 수 없습니다");
        return;
      }
      onRouteFound(origin, destination, data.routeId, data.vertexes);
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <div className="card">
        <PlaceInput label="출발지" value={origin} onSelect={setOrigin} dotColor="#4f8ef7" />
        <div className="placeRow">
          <PlaceInput label="목적지" value={destination} onSelect={setDestination} dotColor="#222" />
          <button className="swapBtn" onClick={swap} aria-label="출발지/목적지 바꾸기">
            ↑↓
          </button>
        </div>
      </div>

      <button
        className="primaryBtn"
        disabled={!origin || !destination || loading}
        onClick={searchRoute}
      >
        {loading ? "경로 탐색 중…" : "경로 탐색"}
      </button>

      {error && <p className="errorText">{error}</p>}

      <KakaoMap
        markers={[
          ...(origin ? [{ x: origin.x, y: origin.y, color: "#4f8ef7" }] : []),
          ...(destination ? [{ x: destination.x, y: destination.y, color: "#222" }] : []),
        ]}
      />
    </div>
  );
}
