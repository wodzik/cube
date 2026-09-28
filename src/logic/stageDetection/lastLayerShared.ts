/**
 * Faces and slots in cubing's orbit order — for the piece masks (Practice
 * group masks, Academy views: trainer/trainerMasks.ts, maskPieceGroups.ts).
 * Stage detection itself is cubecore's (methodTracker.ts).
 */

export type Face = "U" | "D" | "F" | "B" | "L" | "R";
export const FACES: readonly Face[] = ["U", "D", "F", "B", "L", "R"];
export const OPPOSITE_FACE: Record<Face, Face> = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };

/**
 * Version of the CFOP / LBL stage detection a record's boundaries were
 * computed with (SolveRecord.stagesVersion). 2: OLL by stickers (before, a
 * cross on any colour but white / yellow only saw its OLL at the very end).
 * 3: cubecore's MethodTracker. Records below it are recomputed
 * (SolveAnalysis on open, services/stageHeal.ts in the background).
 */
export const STAGES_VERSION = 3;

export interface FaceSlots {
  /** The 4 edge slots touching this face — cross for this face, OLL-orientation-check for its opposite. */
  edgeSlots: number[];
  /** The 4 corner slots touching this face — first-layer corners for this face, OLL-orientation-check for its opposite. */
  cornerSlots: number[];
}

// Derived from first principles (each corner's two non-cross-face faces
// determine its adjoining middle-layer edge) and cross-checked against the
// D-face case, which matches the pre-existing (verified-correct) mapping.
export const FACE_SLOTS: Record<Face, FaceSlots> = {
  U: { edgeSlots: [0, 1, 2, 3], cornerSlots: [0, 1, 2, 3] },
  D: { edgeSlots: [4, 5, 6, 7], cornerSlots: [4, 5, 6, 7] },
  F: { edgeSlots: [0, 4, 8, 9], cornerSlots: [0, 3, 4, 5] },
  B: { edgeSlots: [2, 6, 10, 11], cornerSlots: [1, 2, 6, 7] },
  L: { edgeSlots: [3, 7, 9, 11], cornerSlots: [2, 3, 5, 6] },
  R: { edgeSlots: [1, 5, 8, 10], cornerSlots: [0, 1, 4, 7] },
};

/**
 * The 4 middle-layer (second-layer) edge slots for each face, positionally
 * paired with FACE_SLOTS[face].cornerSlots (index i's corner sits directly
 * above/below index i's middle edge once that slot is solved) — CFOP uses
 * this pairing to build its F2L corner+edge combos; LBL uses the same 4
 * slots as a plain "are these 4 middle edges placed" count, since it solves
 * corners and edges in two separate passes rather than pairing them.
 * Derived from first principles (each corner's two non-cross-face faces
 * determine its adjoining middle-layer edge) and cross-checked against the
 * D-face case, which matches the pre-existing (verified-correct) mapping.
 */
export const MIDDLE_LAYER_EDGE_SLOTS: Record<Face, number[]> = {
  U: [8, 10, 11, 9], // FR, BR, BL, FL
  D: [8, 9, 11, 10], // FR, FL, BL, BR
  F: [1, 3, 5, 7], // UR, UL, DR, DL
  B: [1, 3, 7, 5], // UR, UL, DL, DR
  L: [2, 0, 4, 6], // UB, UF, DF, DB
  R: [0, 2, 4, 6], // UF, UB, DF, DB
};
