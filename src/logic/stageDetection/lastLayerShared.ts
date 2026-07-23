/**
 * Shared, method-agnostic helpers for any CFOP-family method that builds a
 * FACE-AGNOSTIC cross first — CFOP (cfopStages.ts) and LBL (lblStages.ts)
 * both reuse every export here; they only differ in how they get from
 * "cross done" to "first two layers done": CFOP pairs corner+edge into F2L
 * slots, LBL places 4 first-layer corners then 4 second-layer edges
 * separately. Roux doesn't use any of this — it tracks fixed
 * absolute-position blocks, not a face-agnostic cross (see rouxStages.ts).
 *
 * Extracted out of cfopStages.ts so a second face-agnostic method (LBL)
 * never had to re-derive or duplicate cross/OLL/PLL/AUF detection.
 */

import { applyMoveToState, isFullySolved, isSlotSolved, type LiveCubeState } from "./liveCubeState";

// Slot indices — see liveCubeState.ts doc comment for the verified mapping:
//   CORNERS: 0=URF 1=UBR 2=ULB 3=UFL 4=DFR 5=DLF 6=DBL 7=DRB
//   EDGES:   0=UF  1=UR  2=UB  3=UL  4=DF  5=DR  6=DB  7=DL  8=FR 9=FL 10=BR 11=BL
export type Face = "U" | "D" | "F" | "B" | "L" | "R";
export const FACES: readonly Face[] = ["U", "D", "F", "B", "L", "R"];
export const OPPOSITE_FACE: Record<Face, Face> = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };

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

export function isCrossSolvedOnFace(state: LiveCubeState, face: Face): boolean {
  const edges = state.patternData.EDGES;
  return FACE_SLOTS[face].edgeSlots.every((slot) => isSlotSolved(edges, slot));
}

/** The face currently hosting a solved cross, or null if none does. */
export function detectCrossFace(state: LiveCubeState): Face | null {
  return FACES.find((face) => isCrossSolvedOnFace(state, face)) ?? null;
}

/** Last-layer CORNERS only oriented (2-look OLL's "orient corners" half) — permutation not checked. */
export function isOllCornersOrientedOnFace(state: LiveCubeState, face: Face): boolean {
  const corners = state.patternData.CORNERS;
  return FACE_SLOTS[OPPOSITE_FACE[face]].cornerSlots.every((slot) => corners.orientation[slot] === 0);
}

/** Last-layer EDGES only oriented (2-look OLL's "orient edges" half, i.e. the top cross) — permutation not checked. */
export function isOllEdgesOrientedOnFace(state: LiveCubeState, face: Face): boolean {
  const edges = state.patternData.EDGES;
  return FACE_SLOTS[OPPOSITE_FACE[face]].edgeSlots.every((slot) => edges.orientation[slot] === 0);
}

export function isOllSolvedOnFace(state: LiveCubeState, face: Face): boolean {
  return isOllCornersOrientedOnFace(state, face) && isOllEdgesOrientedOnFace(state, face);
}

/** PLL (+ trailing AUF) done: some 0-3 quarter turn of the last layer fully solves the cube. */
export function isPllSolvedOnFace(state: LiveCubeState, face: Face): boolean {
  const aufFace = OPPOSITE_FACE[face];
  let s = state;
  for (let i = 0; i < 4; i++) {
    if (isFullySolved(s)) return true;
    if (i < 3) s = applyMoveToState(s, aufFace);
  }
  return false;
}

/**
 * Last-layer CORNERS only permuted (2-look PLL's "permute corners" half,
 * e.g. an Aa/Ab-perm) — some 0-3 quarter turn of the last layer puts every
 * opposite-face corner in its own home slot. Edges/orientation not
 * checked: this only makes sense once OLL is already done (corners are
 * then either home or not — orientation is a non-issue), but checks
 * position only regardless, so it can't misreport an oriented-but-not-yet-
 * permuted state as done.
 */
export function isPllCornersSolvedOnFace(state: LiveCubeState, face: Face): boolean {
  const aufFace = OPPOSITE_FACE[face];
  const cornerSlots = FACE_SLOTS[OPPOSITE_FACE[face]].cornerSlots;
  let s = state;
  for (let i = 0; i < 4; i++) {
    if (cornerSlots.every((slot) => s.patternData.CORNERS.pieces[slot] === slot)) return true;
    if (i < 3) s = applyMoveToState(s, aufFace);
  }
  return false;
}

/**
 * Per-walk context: remembers which face the cross was built on, the moment
 * it's first detected — see StageDetector's doc comment (types.ts) for why
 * re-detecting fresh on every stage is unsafe (a short sequence can
 * coincidentally line up a different face's cross too). Shared shape so
 * every face-agnostic-cross method's createContext can return exactly this.
 */
export interface LockedFaceContext {
  lockedFace: Face | null;
}

export function isLockedFaceContext(context: unknown): context is LockedFaceContext {
  return typeof context === "object" && context !== null && "lockedFace" in context;
}

/** Locks `context.lockedFace` to `face` the first time it's non-null — a no-op once already locked, or if context isn't a LockedFaceContext (standalone/test call). */
export function lockFaceIfUnset(context: unknown, face: Face | null): void {
  if (face && isLockedFaceContext(context) && !context.lockedFace) context.lockedFace = face;
}

/**
 * The face a later stage (f2l/first-layer/oll/pll) should check against:
 * the locked face if this call is part of a tracked walk, otherwise
 * `fallbackDetect`'s best-effort fresh detection (standalone/test calls
 * with no context). `fallbackDetect` is method-specific (e.g. CFOP prefers
 * an F2L-complete face; LBL would prefer a first-layer-complete face) so
 * it's supplied by the caller rather than hardcoded here.
 */
export function resolveFace(
  context: unknown,
  state: LiveCubeState,
  fallbackDetect: (state: LiveCubeState) => Face | null
): Face | null {
  if (isLockedFaceContext(context)) return context.lockedFace;
  return fallbackDetect(state);
}
