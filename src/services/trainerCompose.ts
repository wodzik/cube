/**
 * Shared composition step for ALL trainer scramble generators (CFOP-family
 * in trainerScrambleService.ts, Roux in rouxTrainerService.ts).
 *
 * Given the app-frame target generator INVERSE `c` (pure face turns whose
 * inverse generates the intended end state from solved) and the cube's
 * current transformation, produce the scramble the user should perform —
 * verified piece-for-piece against the intended end state, which is
 * from-independent: T_c⁻¹. See trainerScrambleService.ts's module doc for
 * the full algebra.
 */

import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import { experimentalSolve3x3x3IgnoringCenters } from "cubing/search";
import type { KTransformation } from "cubing/kpuzzle";
import { invertSequence } from "../logic/moveParser";

export function tokenize(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

/**
 * Compare two patterns on their movable pieces, ignoring CENTER ORIENTATION:
 * two different face-turn routes to the same piece state twist the fixed
 * centers differently, and that twist is invisible on a physical cube.
 * Center POSITIONS still must match (both sides are face-turn-only here, so
 * a mismatch would mean a frame error — exactly what this check exists to
 * catch).
 */
export function samePiecesIgnoringCenterTwist(
  a: { patternData: Record<string, { pieces: number[]; orientation: number[] }> },
  b: { patternData: Record<string, { pieces: number[]; orientation: number[] }> }
): boolean {
  for (const orbit of ["EDGES", "CORNERS"]) {
    const oa = a.patternData[orbit];
    const ob = b.patternData[orbit];
    if (oa.pieces.join() !== ob.pieces.join()) return false;
    if (oa.orientation.join() !== ob.orientation.join()) return false;
  }
  return a.patternData.CENTERS.pieces.join() === b.patternData.CENTERS.pieces.join();
}

/** Returns null when verification fails — caller retries with a fresh sample. */
export async function composeScramble(
  kpuzzle: Awaited<ReturnType<typeof cube3x3x3.kpuzzle>>,
  /** App-frame face-turn tokens; the intended end state is T_c⁻¹ applied to solved. */
  c: readonly string[],
  from: KTransformation
): Promise<{ scramble: string; viewSetupAlg: string } | null> {
  const pattern = kpuzzle.defaultPattern().applyAlg(new Alg(c.join(" "))).applyTransformation(from);
  const scramble = (await experimentalSolve3x3x3IgnoringCenters(pattern)).toString().trim();
  const scrambleTokens = tokenize(scramble);

  const actual = kpuzzle.defaultPattern().applyTransformation(from).applyAlg(scramble);
  const expected = kpuzzle.defaultPattern().applyAlg(invertSequence([...c]).join(" "));
  if (!samePiecesIgnoringCenterTwist(actual, expected)) return null;

  return { scramble, viewSetupAlg: invertSequence([...scrambleTokens, ...c]).join(" ") };
}
