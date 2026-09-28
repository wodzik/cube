/**
 * Stored solves' CFOP / LBL boundaries recomputed with the current stage
 * detection (STAGES_VERSION) — in the background after start, so case stats
 * (OLL / PLL counts and times) are right without opening each solve. Only a
 * cross on a side colour was affected by version 1 (its OLL was only seen at
 * the very end); white / yellow crosses are just stamped.
 */

import type { StageBoundary } from "../logic/stageDetection/types";
import type { SolveRecord } from "../types/solve";
import { STAGES_VERSION } from "../logic/stageDetection/lastLayerShared";
import { applyMoveToState, createSolvedState } from "../logic/stageDetection/liveCubeState";
import { computeStageBoundaries } from "../logic/stageDetection/methodTracker";
import { cfopStageDetector } from "../logic/stageDetection/cfopStages";
import { lblStageDetector } from "../logic/stageDetection/lblStages";
import { getSolves, patchSolves } from "./solveStore";

const pause = () => new Promise((r) => setTimeout(r, 0));

/** Cross on U or D (white / yellow in the usual scheme): version 1 had it right. */
const crossOnUD = (s: SolveRecord) => {
  const face = s.cfop?.find((b) => b.stage === "cross")?.detail;
  return face === undefined || face === "U" || face === "D";
};

export async function healStageBoundaries(): Promise<number> {
  const stale = getSolves().filter((s) => s.stagesVersion !== STAGES_VERSION);
  if (stale.length === 0) return 0;
  const solved = await createSolvedState();
  const patches = new Map<string, { cfop?: StageBoundary[]; lbl?: StageBoundary[]; stagesVersion: number }>();
  let recomputed = 0;
  for (const [i, s] of stale.entries()) {
    if (crossOnUD(s) || s.moves.length === 0) {
      patches.set(s.id, { stagesVersion: STAGES_VERSION });
      continue;
    }
    const start = s.scramble
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .reduce((st, m) => applyMoveToState(st, m), solved);
    const moves = s.moves.map((m) => ({ move: m.move, relativeMs: m.relativeMs }));
    patches.set(s.id, {
      cfop: computeStageBoundaries(cfopStageDetector, moves, start),
      lbl: computeStageBoundaries(lblStageDetector, moves, start),
      stagesVersion: STAGES_VERSION,
    });
    recomputed++;
    // Don't hold the page up: a breather every few solves.
    if (i % 10 === 9) await pause();
  }
  patchSolves(patches);
  return recomputed;
}
