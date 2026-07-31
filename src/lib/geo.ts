/**
 * 지오 연산 — 로컬 평면 근사 기반 (Python src/backend/app/geo.py 참고 이식, 검증 후 신뢰).
 *
 * 위경도를 기준 위도의 미터 스케일로 변환해 평면 벡터로 다룬다.
 * 수백 m~수 km 스케일에서 오차 미미. 전국 단위 정밀도가 필요하면 측지선 거리
 * 계산(@turf/distance 등)의 도입을 검토.  ※ 현재 turf 의존성은 없음.
 * 좌표 표기: (x=경도, y=위도) — 카카오 API와 동일.
 */

import type { Point, Side } from "./types";

// 좌표/방향 타입의 정의는 types.ts 하나 — 여기서는 기존 import 경로 유지를 위해 재수출만 한다.
export type { Point, Side };

const M_PER_DEG_LAT = 110_540.0;
const M_PER_DEG_LON_EQ = 111_320.0;

function toPlane(x: number, y: number, refY: number): [number, number] {
  return [x * M_PER_DEG_LON_EQ * Math.cos((refY * Math.PI) / 180), y * M_PER_DEG_LAT];
}

function pointSegDistM(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
  refY: number,
): number {
  const p = toPlane(px, py, refY);
  const a = toPlane(ax, ay, refY);
  const b = toPlane(bx, by, refY);
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const apx = p[0] - a[0], apy = p[1] - a[1];
  const abLen2 = abx * abx + aby * aby;
  const t = abLen2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLen2));
  const cx = a[0] + t * abx, cy = a[1] + t * aby;
  return Math.hypot(p[0] - cx, p[1] - cy);
}

export function nearestSegment(vertexes: Point[], px: number, py: number): { distM: number; segIdx: number } {
  let bestD = Infinity;
  let bestI = 0;
  for (let i = 0; i < vertexes.length - 1; i++) {
    const a = vertexes[i], b = vertexes[i + 1];
    const d = pointSegDistM(px, py, a.x, a.y, b.x, b.y, py);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return { distM: bestD, segIdx: bestI };
}

/**
 * 진행 방향 기준 좌/우 판별. 부호 규약 (SPEC §10-D2):
 *   cross = forward.x * toPoi.y - forward.y * toPoi.x
 *   cross > 0 → OPPOSITE (왼쪽, 유턴 필요) / cross <= 0 → SAME (오른쪽)
 */
export function sideOfRoute(vertexes: Point[], segIdx: number, px: number, py: number): Side {
  const refY = py;

  const segVec = (i: number): [number, number] => {
    const a = toPlane(vertexes[i].x, vertexes[i].y, refY);
    const b = toPlane(vertexes[i + 1].x, vertexes[i + 1].y, refY);
    return [b[0] - a[0], b[1] - a[1]];
  };

  // 급커브 감지: 인접 세그먼트 간 방향차 > 90° → 판정 보류
  const cur = segVec(segIdx);
  for (const j of [segIdx - 1, segIdx + 1]) {
    if (j >= 0 && j < vertexes.length - 1) {
      const other = segVec(j);
      if (cur[0] * other[0] + cur[1] * other[1] < 0) {
        return "UNKNOWN";
      }
    }
  }

  // 진행 벡터 스무딩: 전후 포함 평균 방향 (근방 2~3개 포인트)
  const i0 = Math.max(0, segIdx - 1);
  const i1 = Math.min(vertexes.length - 1, segIdx + 2);
  const a = toPlane(vertexes[i0].x, vertexes[i0].y, refY);
  const b = toPlane(vertexes[i1].x, vertexes[i1].y, refY);
  const vx = b[0] - a[0], vy = b[1] - a[1];

  const base = toPlane(vertexes[segIdx].x, vertexes[segIdx].y, refY);
  const p = toPlane(px, py, refY);
  const cross = vx * (p[1] - base[1]) - vy * (p[0] - base[0]);
  return cross > 0 ? "OPPOSITE" : "SAME";
}

export function sampleRoute(vertexes: Point[], gapM: number): Point[] {
  if (vertexes.length === 0) return [];
  const samples: Point[] = [vertexes[0]];
  let acc = 0;
  for (let i = 0; i < vertexes.length - 1; i++) {
    const a = vertexes[i], b = vertexes[i + 1];
    const pa = toPlane(a.x, a.y, a.y);
    const pb = toPlane(b.x, b.y, a.y);
    acc += Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    if (acc >= gapM) {
      samples.push(vertexes[i + 1]);
      acc = 0;
    }
  }
  const last = samples[samples.length - 1];
  const lastVertex = vertexes[vertexes.length - 1];
  if (last.x !== lastVertex.x || last.y !== lastVertex.y) {
    samples.push(lastVertex);
  }
  return samples;
}

export function offsetPoint(x: number, y: number, dxM: number, dyM: number): Point {
  return {
    x: x + dxM / (M_PER_DEG_LON_EQ * Math.cos((y * Math.PI) / 180)),
    y: y + dyM / M_PER_DEG_LAT,
  };
}
