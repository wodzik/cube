/**
 * Detects which of the 24 whole-cube orientations an Orientation mapping
 * (moveParser's hardware-frame shift tracking) corresponds to — used to
 * turn an accumulated cross-algorithm orientation shift into a rotation
 * alg string (e.g. "x2") for display purposes (the case setup shown on
 * screen). Pure moveParser math, no kpuzzle involved — verified equivalent
 * to the earlier kpuzzle-centers-based approach for all 24 rotations and
 * several real EO4A algorithms.
 */

import { finalOrientationAfterAlg, identityOrientation } from "../moveParser";
import type { Face, Orientation } from "../../types/cube";

const TOP_CHOICES = ["", "z", "z'", "x", "x'", "x2"];
const SPINS = ["", "y", "y2", "y'"];
const ALL_ROTATIONS: string[] = TOP_CHOICES.flatMap((t) => SPINS.map((s) => `${t} ${s}`.trim()));
const FACE_ORDER: Face[] = ["U", "D", "F", "B", "R", "L"];

function orientationKey(o: Orientation): string {
  return FACE_ORDER.map((f) => o[f]).join(",");
}

let rotationTable: Map<string, string> | null = null;

function rotationTableSingleton(): Map<string, string> {
  if (rotationTable) return rotationTable;
  const table = new Map<string, string>();
  for (const rot of ALL_ROTATIONS) {
    const o = rot ? finalOrientationAfterAlg(rot) : identityOrientation();
    table.set(orientationKey(o), rot);
  }
  rotationTable = table;
  return table;
}

/**
 * Returns the alg string (e.g. "x2", "y z'") for whichever of the 24 whole-
 * cube rotations this orientation mapping matches, or "" if it's identity.
 */
export function rotationStringForOrientation(o: Orientation): string {
  return rotationTableSingleton().get(orientationKey(o)) ?? "";
}
