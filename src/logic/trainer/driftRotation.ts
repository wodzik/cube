/**
 * Detects the net whole-cube rotation baked into a tracked physical
 * transformation, by matching its CENTERS against each of the 24 possible
 * cube orientations — used so a case's displayed setup can be shown in
 * whatever orientation the user's real smart cube is currently drifted to
 * (e.g. after M-slice-heavy Roux algorithms rotate U/F/D/B as a group),
 * without requiring them to regrip the cube to match a fixed canonical
 * display every time.
 *
 * Only CENTERS are compared (not edges/corners) so this still resolves
 * correctly even mid-attempt, when edges/corners aren't solved yet.
 */

import type { KPuzzle, KTransformation } from "cubing/kpuzzle";

const TOP_CHOICES = ["", "z", "z'", "x", "x'", "x2"];
const SPINS = ["", "y", "y2", "y'"];
const ALL_ROTATIONS: string[] = TOP_CHOICES.flatMap((t) => SPINS.map((s) => `${t} ${s}`.trim()));

function centersKey(pieces: readonly number[]): string {
  return pieces.join(",");
}

let rotationTableCache: { kp: KPuzzle; table: Map<string, string> } | null = null;

function rotationTableFor(kp: KPuzzle): Map<string, string> {
  if (rotationTableCache?.kp === kp) return rotationTableCache.table;
  const table = new Map<string, string>();
  for (const rot of ALL_ROTATIONS) {
    const pattern = rot ? kp.defaultPattern().applyAlg(rot) : kp.defaultPattern();
    table.set(centersKey(pattern.patternData.CENTERS.pieces as number[]), rot);
  }
  rotationTableCache = { kp, table };
  return table;
}

/**
 * Returns the alg string (e.g. "x2", "y z'") for whichever of the 24 whole-
 * cube rotations currently matches the transformation's centers, or "" if
 * it's identity (or no pure rotation matches, e.g. mid-attempt).
 */
export function detectDriftRotation(kp: KPuzzle, transformation: KTransformation): string {
  const pattern = kp.defaultPattern().applyTransformation(transformation);
  const key = centersKey(pattern.patternData.CENTERS.pieces as number[]);
  return rotationTableFor(kp).get(key) ?? "";
}
