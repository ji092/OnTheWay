"use client";
import { useState } from "react";
import Header from "@/components/Header";
import StepHome from "@/components/StepHome";
import StepStyle from "@/components/StepStyle";
import StepResults from "@/components/StepResults";
import { requestRoute } from "@/lib/routeClient";
import type { Place, Point, SortStyle } from "@/lib/types";

type Step =
  | { name: "home" }
  | { name: "style"; origin: Place; destination: Place; routeId: string; vertexes: Point[] }
  | {
      name: "results";
      origin: Place;
      destination: Place;
      routeId: string;
      vertexes: Point[];
      sortStyle: SortStyle;
    };

export default function Home() {
  const [step, setStep] = useState<Step>({ name: "home" });

  /**
   * 경로 캐시가 만료(E-204)됐을 때 같은 출발지·목적지로 경로만 다시 받아온다.
   * 사용자를 홈으로 되돌리면 방금 고른 카테고리와 필터가 전부 날아가므로,
   * 화면은 그대로 두고 routeId만 갈아끼운다. 새 routeId가 내려가면 결과 화면이
   * 알아서 다시 검색한다.
   */
  async function refreshRoute(): Promise<boolean> {
    if (step.name !== "results") return false;
    try {
      const { routeId, vertexes } = await requestRoute(step.origin, step.destination);
      setStep({ ...step, routeId, vertexes });
      return true;
    } catch {
      // 재조회까지 실패하면 결과 화면이 사용자에게 안내한다.
      return false;
    }
  }

  return (
    <div className="page">
      <Header
        right={step.name !== "home" ? <span className="stepBadge">{stepLabel(step)}</span> : undefined}
      />
      {step.name === "home" && (
        <StepHome
          onRouteFound={(origin, destination, routeId, vertexes) =>
            setStep({ name: "style", origin, destination, routeId, vertexes })
          }
        />
      )}
      {step.name === "style" && (
        <StepStyle
          origin={step.origin}
          destination={step.destination}
          vertexes={step.vertexes}
          onSelect={(sortStyle) =>
            setStep({
              name: "results",
              origin: step.origin,
              destination: step.destination,
              routeId: step.routeId,
              vertexes: step.vertexes,
              sortStyle,
            })
          }
        />
      )}
      {step.name === "results" && (
        <StepResults
          routeId={step.routeId}
          origin={step.origin}
          destination={step.destination}
          sortStyle={step.sortStyle}
          onRouteExpired={refreshRoute}
          onNewSearch={() => setStep({ name: "home" })}
          onBackToStyle={() =>
            setStep({
              name: "style",
              origin: step.origin,
              destination: step.destination,
              routeId: step.routeId,
              vertexes: step.vertexes,
            })
          }
        />
      )}
      <footer className="footer">네이버맵 연동 · 경로 기반 경유지 탐색</footer>
    </div>
  );
}

function stepLabel(step: Step): string {
  if (step.name === "results") {
    return { distance: "최소 거리", time: "최단 시간", recommended: "추천 경로" }[step.sortStyle];
  }
  return "";
}
