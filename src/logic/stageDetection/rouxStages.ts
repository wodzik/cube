/**
 * Roux: first block → second block → CMLL → LSE — cubecore's Roux method
 * (which splits LSE into EO, UL/UR and the last four edges; the app shows
 * them as one "lse", done with the last).
 *
 * Details, as colours (a face's letter = the colour of its centre): fb its
 * floor + wall ("DL"), sb its floor + wall ("DR"), cmll the wall pair the
 * blocks never touch ("FB"), lse the floor ("D").
 */

import { ROUX } from "@wodzik/cubecore/roux";
import type { StageDetector } from "./types";

/** Bump when stored Roux details change shape (see SolveRecord.rouxDetailVersion, SolveAnalysis's self-heal). */
export const ROUX_DETAIL_VERSION = 3;

export const rouxStageDetector: StageDetector = {
  method: "Roux",
  stages: ["fb", "sb", "cmll", "lse"],
  cubecore: ROUX,
  stageId: (id) => (id === "l4e" ? "lse" : id === "fb" || id === "sb" || id === "cmll" ? id : null),
  // cubecore reports them as colours already (a smart cube's M moves the floor it sees, not the colours).
  detail: (_stage, raw) => raw,
};
