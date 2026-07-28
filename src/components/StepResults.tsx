"use client";
import { useEffect, useMemo, useState } from "react";
import ResultCard from "./ResultCard";
import { launchNaverNavigation } from "@/lib/naver";
import { CATEGORY_LABEL, CATEGORY_QUERY, type Candidate, type Place, type SortStyle } from "@/lib/types";

type Category = "all" | "dt" | "gas" | "restroom";
const DEVIATION_OPTIONS = [100, 300, 500] as const;

async function fetchCandidates(routeId: string, query: string): Promise<Candidate[]> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ routeId, query }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.candidates ?? [];
}

export default function StepResults({
  routeId,
  origin,
  destination,
  sortStyle,
  onNewSearch,
}: {
  routeId: string;
  origin: Place;
  destination: Place;
  sortStyle: SortStyle;
  onNewSearch: () => void;
}) {
  const [category, setCategory] = useState<Category>("all");
  const [deviation, setDeviation] = useState<number>(500);
  const [excludeUturn, setExcludeUturn] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelectedId(null);
    (async () => {
      let results: Candidate[];
      if (category === "all") {
        const lists = await Promise.all(
          (Object.keys(CATEGORY_QUERY) as (keyof typeof CATEGORY_QUERY)[]).map((c) =>
            fetchCandidates(routeId, CATEGORY_QUERY[c]),
          ),
        );
        const seen = new Map<string, Candidate>();
        for (const list of lists) for (const c of list) if (!seen.has(c.placeId)) seen.set(c.placeId, c);
        results = [...seen.values()];
      } else {
        results = await fetchCandidates(routeId, CATEGORY_QUERY[category]);
      }
      if (!cancelled) {
        setCandidates(results);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId, category]);

  const filtered = useMemo(() => {
    let list = candidates.filter((c) => c.distM <= deviation);
    if (excludeUturn) list = list.filter((c) => c.side !== "OPPOSITE");
    const sorted = [...list];
    if (sortStyle === "distance") sorted.sort((a, b) => a.distM - b.distM);
    else if (sortStyle === "time") sorted.sort((a, b) => a.approxExtraSec - b.approxExtraSec);
    else sorted.sort((a, b) => b.score - a.score);
    return sorted;
  }, [candidates, deviation, excludeUturn, sortStyle]);

  const selected = filtered.find((c) => c.placeId === selectedId) ?? null;

  function handleNavigate() {
    if (!selected) return;
    setShowToast(true);
    launchNaverNavigation(
      { lat: destination.y, lng: destination.x, name: destination.name },
      { lat: selected.y, lng: selected.x, name: selected.name },
      "On The Way",
    );
    setTimeout(() => setShowToast(false), 2500);
  }

  return (
    <div className="screen resultsScreen">
      <div className="resultsHeader">
        <span className="routeLabel">
          📍 {origin.name} → {destination.name}
        </span>
        <button className="linkBtn" onClick={onNewSearch}>
          ⟳ 새 검색
        </button>
      </div>

      <div className="chipRow">
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
          <button
            key={c}
            className={`chip${category === c ? " chipActive" : ""}`}
            onClick={() => setCategory(c)}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <div className="filterSection">
        <div className="filterHeader">경로 이탈 허용</div>
        <div className="chipRow">
          {DEVIATION_OPTIONS.map((d) => (
            <button
              key={d}
              className={`chip${deviation === d ? " chipActive" : ""}`}
              onClick={() => setDeviation(d)}
            >
              {d}m
            </button>
          ))}
        </div>
        <div className="chipRow">
          <button
            className={`chip${excludeUturn ? " chipActive" : ""}`}
            onClick={() => setExcludeUturn((v) => !v)}
          >
            ⊘ 유턴 제외
          </button>
        </div>
      </div>

      <div className="resultsListHeader">경유지 추천 {filtered.length}곳</div>
      <div className="resultsList">
        {loading && <p className="loadingText">검색 중…</p>}
        {!loading && filtered.length === 0 && (
          <p className="emptyText">조건에 맞는 곳이 없어요 — 이탈 허용 거리를 늘려보세요</p>
        )}
        {filtered.map((c) => (
          <ResultCard
            key={c.placeId}
            candidate={c}
            selected={c.placeId === selectedId}
            onSelect={() => setSelectedId(c.placeId)}
          />
        ))}
      </div>

      <button className="primaryBtn stickyBtn" disabled={!selected} onClick={handleNavigate}>
        ➤ 네이버맵으로 경유지 추가 안내
      </button>
      <p className="naverNote">네이버맵 앱이 설치되어 있어야 합니다</p>

      {showToast && <div className="toast">✓ 네이버맵 앱이 열립니다</div>}
    </div>
  );
}
