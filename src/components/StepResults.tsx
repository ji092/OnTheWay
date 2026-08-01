"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import ResultCard from "./ResultCard";
import { launchNaverNavigation } from "@/lib/naver";
import {
  CATEGORY_LABEL,
  CATEGORY_QUERY,
  type Candidate,
  type Category,
  type Place,
  type SortStyle,
} from "@/lib/types";

/** 칩에는 실제 카테고리 외에 "전체"가 하나 더 있다. */
type CategoryFilter = "all" | Category;
const DEVIATION_OPTIONS = [100, 300, 500] as const;

/** 실패 시 서버가 준 메시지를 그대로 담아 throw — 빈 결과와 에러를 구분하기 위함 */
async function fetchCandidates(
  routeId: string,
  query: string,
  category: Category,
): Promise<Candidate[]> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ routeId, query, category }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message ?? "검색 중 오류가 발생했습니다");
  }
  return data?.candidates ?? [];
}

type ExtraTimeResult = {
  placeId: string;
  extraSec: number | null;
  extraDistM: number | null;
  approx: boolean;
};

/** 정밀 계산이 성공한 후보만 담는다 — 실패분은 근사치를 그대로 쓰게 비워둔다. */
type PreciseExtra = { extraSec: number; extraDistM: number };

/**
 * 정밀 시간은 실패해도 근사치로 대체하면 되는 보조 기능(FS-4)이라 여기서는
 * throw하지 않고 빈 배열로 안전하게 폴백 — 네트워크 오류로 화면이 멈추는 것만 방지.
 */
async function fetchExtraTime(
  routeId: string,
  pois: { placeId: string; x: number; y: number }[],
): Promise<ExtraTimeResult[]> {
  try {
    const res = await fetch("/api/extra-time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routeId, pois }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

const TOP_N_PRECISE = 3;

export default function StepResults({
  routeId,
  origin,
  destination,
  sortStyle,
  onNewSearch,
  onBackToStyle,
}: {
  routeId: string;
  origin: Place;
  destination: Place;
  sortStyle: SortStyle;
  onNewSearch: () => void;
  onBackToStyle: () => void;
}) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [deviation, setDeviation] = useState<number>(500);
  const [excludeUturn, setExcludeUturn] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [precise, setPrecise] = useState<Map<string, PreciseExtra>>(new Map());
  const [precisionLoading, setPrecisionLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // 탭을 오갈 때마다 같은 검색을 반복하지 않도록 카테고리별 결과를 들고 있는다.
  // "전체"는 카테고리별 응답을 각각 받아오므로, 그때 개별 탭 몫까지 같이 채워둔다.
  // 경로가 바뀌거나 사용자가 "다시 시도"를 누르면(retryCount) 통째로 버린다.
  const cacheRef = useRef({ routeKey: "", byCategory: new Map<CategoryFilter, Candidate[]>() });

  useEffect(() => {
    let cancelled = false;

    const routeKey = `${routeId}:${retryCount}`;
    if (cacheRef.current.routeKey !== routeKey) {
      cacheRef.current = { routeKey, byCategory: new Map() };
    }
    const cache = cacheRef.current.byCategory;

    const cachedResults = cache.get(category);
    if (cachedResults) {
      setCandidates(cachedResults);
      setSearchError(null);
      setSelectedId(null);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setSearchError(null);
      setSelectedId(null);
      try {
        let results: Candidate[];
        if (category === "all") {
          const categories = Object.keys(CATEGORY_QUERY) as (keyof typeof CATEGORY_QUERY)[];
          const settled = await Promise.allSettled(
            categories.map((c) => fetchCandidates(routeId, CATEGORY_QUERY[c], c)),
          );
          const fulfilled = settled.filter(
            (s): s is PromiseFulfilledResult<Candidate[]> => s.status === "fulfilled",
          );
          if (fulfilled.length === 0) {
            const rejected = settled.find((s) => s.status === "rejected") as
              | PromiseRejectedResult
              | undefined;
            throw rejected?.reason ?? new Error("검색 중 오류가 발생했습니다");
          }
          const seen = new Map<string, Candidate>();
          settled.forEach((result, i) => {
            if (result.status !== "fulfilled") return;
            cache.set(categories[i], result.value);
            for (const c of result.value) if (!seen.has(c.placeId)) seen.set(c.placeId, c);
          });
          results = [...seen.values()];
        } else {
          results = await fetchCandidates(routeId, CATEGORY_QUERY[category], category);
        }
        if (!cancelled) {
          cache.set(category, results);
          setCandidates(results);
        }
      } catch (err) {
        if (!cancelled) {
          setCandidates([]);
          setSearchError(err instanceof Error ? err.message : "검색 중 오류가 발생했습니다");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId, category, retryCount]);

  const filtered = useMemo(() => {
    let list = candidates.filter((c) => c.distM <= deviation);
    if (excludeUturn) list = list.filter((c) => c.side !== "OPPOSITE");
    const sorted = [...list];
    if (sortStyle === "distance") sorted.sort((a, b) => a.distM - b.distM);
    else if (sortStyle === "time") sorted.sort((a, b) => a.approxExtraSec - b.approxExtraSec);
    else sorted.sort((a, b) => b.score - a.score);
    return sorted;
  }, [candidates, deviation, excludeUturn, sortStyle]);

  const top3 = filtered.slice(0, TOP_N_PRECISE);
  const top3Key = top3.map((c) => c.placeId).join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (top3.length === 0) {
        setPrecise(new Map());
        return;
      }
      setPrecisionLoading(true);
      const results = await fetchExtraTime(
        routeId,
        top3.map((c) => ({ placeId: c.placeId, x: c.x, y: c.y })),
      );
      if (cancelled) return;
      const next = new Map<string, PreciseExtra>();
      for (const r of results) {
        if (r.approx || r.extraSec === null || r.extraDistM === null) continue;
        next.set(r.placeId, { extraSec: r.extraSec, extraDistM: r.extraDistM });
      }
      setPrecise(next);
      setPrecisionLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // top3Key(placeId 조합)가 바뀔 때만 재호출 — top3 배열 자체는 매 렌더 새 참조라 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, top3Key]);

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
        <button className="linkBtn" onClick={onBackToStyle}>
          ← 뒤로
        </button>
        <span className="routeLabel">
          📍 {origin.name} → {destination.name}
        </span>
        <button className="linkBtn" onClick={onNewSearch}>
          ⟳ 새 검색
        </button>
      </div>

      <div className="chipRow">
        {(Object.keys(CATEGORY_LABEL) as CategoryFilter[]).map((c) => (
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
        {!loading && searchError && (
          <div className="emptyState">
            <p className="errorText">{searchError}</p>
            <div className="chipRow">
              <button className="secondaryBtn" onClick={() => setRetryCount((n) => n + 1)}>
                다시 시도
              </button>
              <button className="secondaryBtn" onClick={onNewSearch}>
                새 검색
              </button>
            </div>
          </div>
        )}
        {!loading && !searchError && filtered.length === 0 && (
          <div className="emptyState">
            <p className="emptyText">조건에 맞는 곳이 없어요 — 이탈 허용 거리를 늘리거나 다른 경로 방식을 선택해보세요</p>
            <button className="secondaryBtn" onClick={onBackToStyle}>
              경로 다시 선택하기
            </button>
          </div>
        )}
        {filtered.map((c, i) => {
          const isTop3 = i < TOP_N_PRECISE;
          return (
            <ResultCard
              key={c.placeId}
              candidate={c}
              selected={c.placeId === selectedId}
              onSelect={() => setSelectedId(c.placeId)}
              sortStyle={sortStyle}
              precise={isTop3 ? precise.get(c.placeId) : undefined}
              precisionLoading={isTop3 && precisionLoading && !precise.has(c.placeId)}
            />
          );
        })}
      </div>

      <button className="primaryBtn stickyBtn" disabled={!selected} onClick={handleNavigate}>
        네이버맵으로 경유지 추가 안내 →
      </button>
      <p className="naverNote">네이버맵 앱이 설치되어 있어야 합니다</p>

      {showToast && <div className="toast">네이버맵 앱이 열립니다</div>}
    </div>
  );
}
