/**
 * Frame bookkeeping for the xcross trainer.
 *
 * The vendored WASM engine natively targets ONE fixed sub-state: the D-face
 * cross plus the BL slot (corner DBL + edge BL) — calibrated empirically by
 * applying its solutions in kpuzzle across multiple scrambles. Any other
 * target is reached by ROTATION CONJUGATION: composing the generated state
 * as rot⁻¹ · (native target) · rot relabels which physical face/slot the
 * xcross lands on, while the optimal solution length is preserved by cube
 * symmetry.
 *
 * nact trains the WHITE cross, which is the U face in the app's fixed
 * scramble frame (WCA orientation: white up, green front — same convention
 * the phase-1 cross trainer and the smart-cube hardware use). The four
 * trainable slots and their calibrated rotations:
 *
 *   slot FR (corner URF, edge FR): rot = "z2 y"
 *   slot BR (corner UBR, edge BR): rot = "z2"
 *   slot FL (corner UFL, edge FL): rot = "z2 y2"
 *   slot BL (corner ULB, edge BL): rot = "z2 y'"
 *
 * (Verified 2026-07-15 against kpuzzle: for each rot, rot' · S · rot of a
 * worker-solved state has exactly that face+slot solved. A unit test
 * re-derives the table's slot indices from FACE_SLOTS to prevent drift.)
 *
 * conjugateFaceTurns translates pure-face-turn sequences between the native
 * frame and ours: rot' · M_f · rot equals a single turn of some other face,
 * and the face mapping is DERIVED from kpuzzle at runtime (never
 * hand-written) by comparing transformations.
 */

import type { KPuzzle } from "cubing/kpuzzle";
import type { Face } from "../stageDetection/lastLayerShared";

export type XCrossSlot = "FR" | "BR" | "FL" | "BL";
export const XCROSS_SLOTS: readonly XCrossSlot[] = ["FR", "BR", "FL", "BL"];

/** The face whose cross the xcross trainer builds on, in the app frame. */
export const XCROSS_CROSS_FACE: Face = "U";

export interface XCrossSlotFrame {
  /** CORNERS orbit slot index (liveCubeState indexing) of the slot's corner. */
  cornerSlot: number;
  /** EDGES orbit slot index of the slot's middle-layer edge. */
  edgeSlot: number;
  /** Rotation whose conjugation maps the WASM's native D/BL target onto this slot. */
  rotation: string;
}

// CORNERS: 0=URF 1=UBR 2=ULB 3=UFL — EDGES: 8=FR 9=FL 10=BR 11=BL
export const XCROSS_SLOT_FRAMES: Record<XCrossSlot, XCrossSlotFrame> = {
  FR: { cornerSlot: 0, edgeSlot: 8, rotation: "z2 y" },
  BR: { cornerSlot: 1, edgeSlot: 10, rotation: "z2" },
  FL: { cornerSlot: 3, edgeSlot: 9, rotation: "z2 y2" },
  BL: { cornerSlot: 2, edgeSlot: 11, rotation: "z2 y'" },
};

/**
 * The free-pair ("pairing") engine shares the xcross engine's native frame
 * exactly (D cross + BL slot — verified empirically 2026-07-15), so its
 * slots reuse XCROSS_SLOT_FRAMES. Its GOAL differs: not "slot inserted" but
 * "pair formed one insert away" — see pairingGoals.ts. These are the
 * engine's native goal generators (applied FROM the inserted state), read
 * from its prune-table seeding: 4 extraction algs × 4 AUFs, plus the
 * inserted state itself.
 */
export const PAIRING_NATIVE_APPL_MOVES = ["L U L'", "L U' L'", "B' U B", "B' U' B"] as const;
export const PAIRING_NATIVE_AUFS = ["", "U", "U2", "U'"] as const;

/** EOCross engine: native = D cross + all edges oriented; z2 puts the cross on U and preserves the F/B EO axis. (Calibrated 2026-07-15.) */
export const EOCROSS_ROTATION = "z2";

// ─── XXCross ───

/** Our-frame slot pairs for the U cross (order canonical: FR < BR < FL < BL). */
export type XXCrossPair = "FR+BR" | "FR+FL" | "BR+BL" | "FL+BL" | "FR+BL" | "BR+FL";
export const XXCROSS_PAIRS: readonly XXCrossPair[] = ["FR+BR", "FR+FL", "BR+BL", "FL+BL", "FR+BL", "BR+FL"];

export interface XXCrossPairFrame {
  /** The two trained slots (see XCROSS_SLOT_FRAMES for their corner/edge indices). */
  slots: [XCrossSlot, XCrossSlot];
  /** Which engine instance handles this pair — adjacent or opposite slots. */
  pairType: "adj" | "opp";
  /** Rotation whose conjugation maps the engine's native pair onto this one. */
  rotation: string;
}

/**
 * Calibrated 2026-07-15: the adjacent-pair engine natively targets
 * D cross + {DBL/BL, DRB/BR}; the opposite-pair engine D cross +
 * {DFR/FR, DBL/BL}. Conjugation by "z2 y^k" maps them onto the U-cross
 * pairs below (verified per entry against kpuzzle).
 */
export const XXCROSS_PAIR_FRAMES: Record<XXCrossPair, XXCrossPairFrame> = {
  "BR+BL": { slots: ["BR", "BL"], pairType: "adj", rotation: "z2" },
  "FR+BR": { slots: ["FR", "BR"], pairType: "adj", rotation: "z2 y" },
  "FR+FL": { slots: ["FR", "FL"], pairType: "adj", rotation: "z2 y2" },
  "FL+BL": { slots: ["FL", "BL"], pairType: "adj", rotation: "z2 y'" },
  "BR+FL": { slots: ["BR", "FL"], pairType: "opp", rotation: "z2" },
  "FR+BL": { slots: ["FR", "BL"], pairType: "opp", rotation: "z2 y" },
};

const FACES: readonly string[] = ["U", "D", "L", "R", "F", "B"];

/**
 * Face mapping under conjugation by `rotation`: mapping[f] = g such that
 * rot' f rot == g (as cube transformations). Derived from kpuzzle.
 */
function conjugationFaceMap(kpuzzle: KPuzzle, rotation: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of FACES) {
    const conjugated = kpuzzle.algToTransformation(`${invertRotation(rotation)} ${f} ${rotation}`);
    const g = FACES.find((cand) => kpuzzle.algToTransformation(cand).isIdentical(conjugated));
    if (!g) throw new Error(`conjugationFaceMap: no face matches rot' ${f} rot for rotation "${rotation}"`);
    map[f] = g;
  }
  return map;
}

export function invertRotation(rotation: string): string {
  return rotation
    .split(/\s+/)
    .filter(Boolean)
    .map((r) => (r.endsWith("2") ? r : r.endsWith("'") ? r.slice(0, -1) : `${r}'`))
    .reverse()
    .join(" ");
}

const faceMapCache = new Map<string, Record<string, string>>();

/**
 * Translate a pure-face-turn token sequence from the WASM's native frame
 * into the app frame for the given conjugating rotation (i.e. compute the
 * face-turn form of rot' · seq · rot).
 */
export function conjugateFaceTurns(kpuzzle: KPuzzle, tokens: readonly string[], rotation: string): string[] {
  let map = faceMapCache.get(rotation);
  if (!map) {
    map = conjugationFaceMap(kpuzzle, rotation);
    faceMapCache.set(rotation, map);
  }
  return tokens.map((t) => {
    const face = t[0];
    const mapped = map[face];
    if (!mapped) throw new Error(`conjugateFaceTurns: not a face turn: "${t}"`);
    return mapped + t.slice(1);
  });
}
