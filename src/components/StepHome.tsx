"use client";
import { useState } from "react";
import PlaceInput from "./PlaceInput";
import KakaoMap from "./KakaoMap";
import { requestRoute } from "@/lib/routeClient";
import type { Place, Point } from "@/lib/types";

export default function StepHome({
  onRouteFound,
}: {
  onRouteFound: (
    origin: Place,
    destination: Place,
    routeId: string,
    vertexes: Point[],
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
      const { routeId, vertexes } = await requestRoute(origin, destination);
      onRouteFound(origin, destination, routeId, vertexes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "경로를 찾을 수 없습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <div className="card">
        <div className="placeInputs">
          <PlaceInput label="출발지" value={origin} onSelect={setOrigin} dotColor="#4f8ef7" />
          <PlaceInput label="목적지" value={destination} onSelect={setDestination} dotColor="#222" />
        </div>
        <button className="swapBtn" onClick={swap} aria-label="출발지/목적지 바꾸기">
          ↑↓
        </button>
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
