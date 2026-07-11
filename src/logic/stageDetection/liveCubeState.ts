/**
 * Shared, single facelet/piece-level cube state — the ONE simulator that all
 * method stage detectors (CFOP, Roux, ...) read from. This is the fix for
 * cube_trainer's cfopAnalysis.ts/rouxAnalysis.ts problem: each of those had
 * its OWN full cube simulation (~1600 lines of duplicated facelet tables
 * between the two). Here there is exactly one simulator; detectors are pure
 * predicates over its output (see cfopStages.ts / rouxStages.ts).
 *
 * Built on cubing/kpuzzle (already a dependency for TwistyPlayer/scramble)
 * rather than a hand-written facelet permutation table — its move
 * application is already correct and battle-tested, so there is no risk of
 * a transcription error in a hand-derived rotation table. We only need to
 * know which piece-orbit slot corresponds to which physical position; that
 * mapping was determined empirically (see cfopStages.ts / rouxStages.ts
 * doc comments) by applying each of the 6 face turns to a solved cube and
 * cross-referencing which slots each move touches — not guessed from memory.
 *
 * Piece slot indices (verified empirically, cross-checked across all 6
 * face turns with no contradictions):
 *   CORNERS: 0=URF 1=UBR 2=ULB 3=UFL 4=DFR 5=DLF 6=DBL 7=DRB
 *   EDGES:   0=UF  1=UR  2=UB  3=UL  4=DF  5=DR  6=DB  7=DL  8=FR 9=FL 10=BR 11=BL
 *
 * A slot is "solved" when patternData.<ORBIT>.pieces[slot] === slot AND
 * .orientation[slot] === 0 — i.e. the piece that belongs there is there,
 * correctly oriented, relative to the fixed reference frame the scramble
 * was generated in (this is self-consistent regardless of which physical
 * color the solver treats as their personal "cross color").
 */

import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern, KPuzzle } from "cubing/kpuzzle";

export type LiveCubeState = KPattern;

let kpuzzlePromise: Promise<KPuzzle> | null = null;

function loadKPuzzle(): Promise<KPuzzle> {
  if (!kpuzzlePromise) kpuzzlePromise = cube3x3x3.kpuzzle();
  return kpuzzlePromise;
}

/** Loads the 3x3x3 puzzle definition once (memoized) and returns the solved state. */
export async function createSolvedState(): Promise<LiveCubeState> {
  const kpuzzle = await loadKPuzzle();
  return kpuzzle.defaultPattern();
}

/** Pure: applies one physical move, returns a new state. Never mutates the input. */
export function applyMoveToState(state: LiveCubeState, move: string): LiveCubeState {
  return state.applyMove(move);
}

export function isFullySolved(state: LiveCubeState): boolean {
  return state.experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true });
}

/** Whether the piece at `slot` (in the given orbit) is in its solved position, correctly oriented. */
export function isSlotSolved(
  orbit: { pieces: number[]; orientation: number[] },
  slot: number
): boolean {
  return orbit.pieces[slot] === slot && orbit.orientation[slot] === 0;
}
