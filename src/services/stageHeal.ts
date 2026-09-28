/**
 * Stored solves' stage boundaries recomputed with the current stage
 * detection (STAGES_VERSION — cubecore's MethodTracker) — in the background
 * after start, a few at a time, so case stats (OLL / PLL counts and times)
 * and the solve lists agree with what a solve's analysis shows, without
 * opening each one.
 */

import type { StageBoundary } from "../logic/stageDetection/types";
import { STAGES_VERSION } from "../logic/stageDetection/lastLayerShared";
import { computeStageBoundaries, startStateOf } from "../logic/stageDetection/methodTracker";
import { cfopStageDetector } from "../logic/stageDetection/cfopStages";
import { lblStageDetector } from "../logic/stageDetection/lblStages";
import { ROUX_DETAIL_VERSION, rouxStageDetector } from "../logic/stageDetection/rouxStages";
import { getSolves, patchSolves } from "./solveStore";

const pause = () => new Promise((r) => setTimeout(r, 0));

interface Patch {
  cfop?: StageBoundary[];
  lbl?: StageBoundary[];
  roux?: StageBoundary[];
  rouxDetailVersion?: number;
  stagesVersion: number;
}

/** Recompute every solve still on an older detection; returns how many were recomputed. */
export async function healStageBoundaries(): Promise<number> {
  const stale = getSolves().filter((s) => s.stagesVersion !== STAGES_VERSION);
  if (stale.length === 0) return 0;
  const patches = new Map<string, Patch>();
  let recomputed = 0;
  for (const [i, s] of stale.entries()) {
    if (s.moves.length === 0) {
      patches.set(s.id, { stagesVersion: STAGES_VERSION });
      continue;
    }
    const start = startStateOf(s.scramble);
    const moves = s.moves.map((m) => ({ move: m.move, relativeMs: m.relativeMs }));
    patches.set(s.id, {
      cfop: computeStageBoundaries(cfopStageDetector, moves, start),
      lbl: computeStageBoundaries(lblStageDetector, moves, start),
      roux: computeStageBoundaries(rouxStageDetector, moves, start),
      rouxDetailVersion: ROUX_DETAIL_VERSION,
      stagesVersion: STAGES_VERSION,
    });
    recomputed++;
    // Don't hold the page up: a breather after every solve.
    if (i % 2 === 1) await pause();
  }
  patchSolves(patches);
  return recomputed;
}
