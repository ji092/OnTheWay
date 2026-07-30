"use client";
import { useState } from "react";
import Header from "@/components/Header";
import StepHome from "@/components/StepHome";
import StepStyle from "@/components/StepStyle";
import StepResults from "@/components/StepResults";
import type { Place, SortStyle } from "@/lib/types";

type Vertex = { x: number; y: number };

type Step =
  | { name: "home" }
  | { name: "style"; origin: Place; destination: Place; routeId: string; vertexes: Vertex[] }
  | {
      name: "results";
      origin: Place;
      destination: Place;
      routeId: string;
      vertexes: Vertex[];
      sortStyle: SortStyle;
    };

export default function Home() {
  const [step, setStep] = useState<Step>({ name: "home" });

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
    return { distance: "거리 우선", time: "시간 우선", recommended: "추천 경로" }[step.sortStyle];
  }
  return "";
}
