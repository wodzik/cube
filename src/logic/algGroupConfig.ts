/**
 * Shared configuration for algorithm groups (OLL / PLL / F2L).
 * Pure module — no React, no side-effects.
 */

import type { AlgGroup, AlgorithmCase, AlgorithmVariant } from "../types/algorithm";
import type { VisualizationMode } from "../types/cube";

/** TwistyPlayer stickering scheme for each group. */
export const STICKERING: Record<AlgGroup, string> = {
  oll: "OLL",
  pll: "PLL",
  "f2l-front-right": "F2L",
  "f2l-front-left": "F2L",
  "f2l-back-right": "F2L",
  "f2l-back-left": "F2L",
  "f2l-advanced": "F2L",
};

/** 2D last-layer view for OLL/PLL; full 3D for F2L. */
export const VISUALIZATION_MODE: Record<AlgGroup, VisualizationMode> = {
  oll: "experimental-2D-LL",
  pll: "experimental-2D-LL",
  "f2l-front-right": "PG3D",
  "f2l-front-left": "PG3D",
  "f2l-back-right": "PG3D",
  "f2l-back-left": "PG3D",
  "f2l-advanced": "PG3D",
};

export const CAMERA: Record<AlgGroup, { latitude: number; longitude: number }> = {
  oll: { latitude: 20, longitude: 20 },
  pll: { latitude: 20, longitude: 20 },
  "f2l-front-right": { latitude: 20, longitude: 25 },
  "f2l-front-left": { latitude: 20, longitude: 25 },
  "f2l-back-right": { latitude: 20, longitude: 25 },
  "f2l-back-left": { latitude: 20, longitude: 25 },
  "f2l-advanced": { latitude: 20, longitude: 25 },
};

/** Returns the default variant for a case, falling back to the first variant. */
export function getDefaultVariant(case_: AlgorithmCase): AlgorithmVariant | undefined {
  return case_.algList.find((v) => v.isDefault) ?? case_.algList[0];
}
