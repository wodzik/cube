/**
 * Free-pair ("pairing") goal detection.
 *
 * The pairing engine's target is NOT "slot inserted" — it is the set of
 * states where the pair is FORMED and one standard insert away: the state
 * reached from the inserted state by one of 4 extraction algs × 4 AUFs,
 * plus the inserted state itself — 17 goal states total (read from the
 * engine's prune-table seeding, see PAIRING_NATIVE_APPL_MOVES).
 *
 * Detection works on SIGNATURES: the placement (slot + orientation) of the
 * 6 tracked pieces — the 4 cross edges plus the trained slot's corner and
 * edge — encoded as a string. The 17 goal signatures are precomputed per
 * slot (native goal generators conjugated into the app frame, applied to
 * solved in kpuzzle), then each live state is a Set lookup. This mirrors
 * the engine's own goal condition exactly: it too only constrains those 6
 * pieces.
 */

import { FACE_SLOTS } from "../stageDetection/lastLayerShared";
import type { LiveCubeState } from "../stageDetection/liveCubeState";
import {
  PAIRING_NATIVE_APPL_MOVES,
  PAIRING_NATIVE_AUFS,
  XCROSS_CROSS_FACE,
  XCROSS_SLOT_FRAMES,
  conjugateFaceTurns,
  type XCrossSlot,
} from "./xcrossFrames";
import type { KPuzzle } from "cubing/kpuzzle";

interface TrackedOrbits {
  EDGES: { pieces: number[]; orientation: number[] };
  CORNERS: { pieces: number[]; orientation: number[] };
}

/** Placement signature of the 6 tracked pieces (4 cross edges + slot pair). */
export function pairingSignature(state: { patternData: TrackedOrbits } | LiveCubeState, slot: XCrossSlot): string {
  const frame = XCROSS_SLOT_FRAMES[slot];
  const edges = state.patternData.EDGES;
  const corners = state.patternData.CORNERS;
  const parts: number[] = [];
  for (const piece of [...FACE_SLOTS[XCROSS_CROSS_FACE].edgeSlots, frame.edgeSlot]) {
    const at = edges.pieces.indexOf(piece);
    parts.push(at * 2 + edges.orientation[at]);
  }
  const at = corners.pieces.indexOf(frame.cornerSlot);
  parts.push(at * 3 + corners.orientation[at]);
  return parts.join(",");
}

const goalCache = new Map<XCrossSlot, Set<string>>();

/** The 17 goal signatures for a slot — inserted, plus every extraction×AUF state. */
export function pairingGoalSignatures(kpuzzle: KPuzzle, slot: XCrossSlot): Set<string> {
  let cached = goalCache.get(slot);
  if (!cached) {
    const rot = XCROSS_SLOT_FRAMES[slot].rotation;
    const generators: string[][] = [[]];
    for (const appl of PAIRING_NATIVE_APPL_MOVES) {
      for (const auf of PAIRING_NATIVE_AUFS) {
        generators.push([...appl.split(" "), ...(auf ? [auf] : [])]);
      }
    }
    cached = new Set(
      generators.map((g) => {
        const appTokens = g.length ? conjugateFaceTurns(kpuzzle, g, rot) : [];
        const pattern = appTokens.length
          ? kpuzzle.defaultPattern().applyAlg(appTokens.join(" "))
          : kpuzzle.defaultPattern();
        return pairingSignature(pattern, slot);
      })
    );
    goalCache.set(slot, cached);
  }
  return cached;
}
