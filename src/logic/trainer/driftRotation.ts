/**
 * Detects which of the 24 whole-cube orientations a pattern's CENTERS
 * currently match — used to track the net center rotation left behind by
 * M-slice-heavy Roux algorithms (verified: performing e.g. "M' U2 M' U2 M
 * U M'" from solved leaves centers x2-rotated even though edges/corners
 * return to solved) purely from the ALGORITHM TEXT, not from live hardware
 * tracking — deterministic and independent of whatever the cube's actual
 * physical state was before the algorithm ran, since a fixed move sequence's
 * effect on centers is the same regardless of starting pattern.
 */

import type { KPattern, KPuzzle } from "cubing/kpuzzle";

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
 * cube rotations currently matches the pattern's centers, or "" if it's
 * identity (or no pure rotation matches — e.g. mid-scramble edges/corners
 * don't affect this, only CENTERS are compared).
 */
export function detectRotationFromPattern(kp: KPuzzle, pattern: KPattern): string {
  const key = centersKey(pattern.patternData.CENTERS.pieces as number[]);
  return rotationTableFor(kp).get(key) ?? "";
}
