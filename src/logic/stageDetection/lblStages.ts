/**
 * Layer by layer (the beginner's method): cross → first-layer corners (four,
 * any order) → second-layer edges (four) → the last layer's orientation in
 * two halves (corners or edges first — 2-look OLL is taught either way) →
 * corners permuted → edges permuted → AUF — cubecore's LBL method, under the
 * app's stage ids.
 *
 * Details: the cross face; the slot of each corner / edge; which half of
 * OLL came first ("corners" / "edges") and, for the second, the other.
 */

import { LBL } from "@wodzik/cubecore/lbl";
import type { StageDetector } from "./types";

const IDS: Record<string, string> = {
  cross: "cross",
  "oll-1": "oll-first",
  "oll-2": "oll-second",
  "pll-corners": "pll-corners",
  pll: "pll-edges",
  auf: "auf",
};

export const lblStageDetector: StageDetector = {
  method: "LBL",
  stages: [
    "cross",
    "first-layer-1",
    "first-layer-2",
    "first-layer-3",
    "first-layer-4",
    "second-layer-1",
    "second-layer-2",
    "second-layer-3",
    "second-layer-4",
    "oll-first",
    "oll-second",
    "pll-corners",
    "pll-edges",
    "auf",
  ],
  cubecore: LBL,
  stageId(id) {
    const n = /^(corner|edge)-(\d)$/.exec(id);
    if (n) return `${n[1] === "corner" ? "first-layer" : "second-layer"}-${n[2]}`;
    return IDS[id] ?? null;
  },
  detail(stage, raw, frame, earlier) {
    if (stage === "cross") return frame?.face.D;
    if (/^(first|second)-layer-\d$/.test(stage)) return raw;
    if (stage === "oll-first") return raw;
    if (stage === "oll-second") {
      const first = earlier.find((b) => b.stage === "oll-first")?.detail;
      return first === "corners" ? "edges" : first === "edges" ? "corners" : undefined;
    }
    return undefined;
  },
};
