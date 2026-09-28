/**
 * Piece masks (in cubing's orbit format — logic/cubecoreMask.ts turns them
 * into cubecore masks): the Practice group mask picker's pieces
 * (pieceMask), the Academy step views and the Roux blocks view.
 *
 * Masks address PIECES (they follow a piece as it moves), in cubing's slot
 * order (CORNERS URF UBR ULB UFL DFR DLF DBL DRB, EDGES UF UR UB UL DF DR DB
 * DL FR FL BR BL).
 */

import type { FaceletMask, StickeringMaskOrbits } from "../../types/cube";

/** Exported for logic/maskPieceGroups.ts — the Practice group mask picker composes piece-groups the same way. */
export function pieceMask(
  visibleEdges: Set<number>,
  visibleCorners: Set<number>,
  /** Edges rendered orientation-only (EO trainers) instead of ignored. */
  orientedEdges: Set<number> = new Set(),
  /** Show centers at full color instead of dim — off by default. */
  showCenters = false
): StickeringMaskOrbits {
  const edge = (piece: number): FaceletMask =>
    visibleEdges.has(piece) ? "regular" : orientedEdges.has(piece) ? "oriented" : "ignored";
  const corner = (piece: number): FaceletMask => (visibleCorners.has(piece) ? "regular" : "ignored");
  const centerFacelet: FaceletMask = showCenters ? "regular" : "dim";
  return {
    orbits: {
      EDGES: {
        pieces: Array.from({ length: 12 }, (_, p) => ({ facelets: [edge(p), edge(p)] })),
      },
      CORNERS: {
        pieces: Array.from({ length: 8 }, (_, p) => ({ facelets: [corner(p), corner(p), corner(p)] })),
      },
      CENTERS: {
        // 4 facelets per center: the CENTERS orbit has numOrientations = 4
        // (center twist), and PG3D reads one mask entry per orientation —
        // fewer entries crashes its setStickeringMask.
        pieces: Array.from({ length: 6 }, () => ({ facelets: [centerFacelet, centerFacelet, centerFacelet, centerFacelet] })),
      },
    },
  };
}

export type AcademyView = "first-layer" | "f2l" | "f2l-edges" | "oll-corners" | "oll" | "corners" | "full";

/**
 * Academy step views (see data/academy.ts). ALL of them are MASKS — even
 * "full" — so a mounted player never has to switch from a mask back to a
 * named stickering (which TwistyPlayer can't do, see CubeVisualisation).
 *
 *  - "oll":         like cubing.js's named "OLL" stickering, except the
 *                   first two layers stay in FULL color (they're solved at
 *                   this point — dimming them only hid the centers the
 *                   solver matches pieces against): LL pieces show ONLY
 *                   their primary (U-face) sticker — facelets
 *                   [regular, ignored, …].
 *  - "oll-corners": same, but LL edges fully blacked out — the
 *                   orient-corners look (corner orientation only).
 *  - "corners":     LL corners in FULL color (permutation visible), LL
 *                   edges blacked out — the permute-corners look.
 *  - "full":        plain cube.
 *  - "first-layer": only the first layer's edges and corners, in full
 *                   color — the first-layer corners drill; the rest is
 *                   greyed out.
 *  - "f2l":         first two layers in full color, the last layer greyed
 *                   out — the second-layer edges drill.
 *  - "f2l-edges":   like "f2l" but EVERY corner greyed out — Zeta
 *                   Slotting's edges step, where no corner has been placed
 *                   yet and a first-layer corner in view would read as
 *                   "supposed to be solved".
 *
 * Frame: the drill applies the inverse of the algorithm to a solved cube
 * with no rotation, and every Academy algorithm (like every OLL) acts on U
 * as the LAST layer — the first-layer corner and second-layer edge inserts
 * drop pieces into the D slots. So "first layer" here means the D-index
 * pieces (4-7) and "last layer" the U-index pieces (0-3), the same
 * piece-index split as logic/guideMasks.ts.
 */
export function academyStepMask(view: AcademyView): StickeringMaskOrbits {
  const U_PIECES = new Set([0, 1, 2, 3]);
  const D_PIECES = new Set([4, 5, 6, 7]);
  const edge = (p: number): ("regular" | "ignored")[] => {
    if (view === "first-layer") return D_PIECES.has(p) ? ["regular", "regular"] : ["ignored", "ignored"];
    if (view === "f2l" || view === "f2l-edges") return U_PIECES.has(p) ? ["ignored", "ignored"] : ["regular", "regular"];
    if (view === "full" || !U_PIECES.has(p)) return ["regular", "regular"];
    if (view === "oll") return ["regular", "ignored"];
    return ["ignored", "ignored"]; // oll-corners, corners
  };
  const corner = (p: number): ("regular" | "ignored")[] => {
    if (view === "f2l-edges") return ["ignored", "ignored", "ignored"];
    if (view === "first-layer") return D_PIECES.has(p) ? ["regular", "regular", "regular"] : ["ignored", "ignored", "ignored"];
    if (view === "f2l") return U_PIECES.has(p) ? ["ignored", "ignored", "ignored"] : ["regular", "regular", "regular"];
    if (view === "full" || view === "corners" || !U_PIECES.has(p)) return ["regular", "regular", "regular"];
    return ["regular", "ignored", "ignored"]; // oll / oll-corners: primary sticker only
  };
  return {
    orbits: {
      EDGES: { pieces: Array.from({ length: 12 }, (_, p) => ({ facelets: edge(p) })) },
      CORNERS: { pieces: Array.from({ length: 8 }, (_, p) => ({ facelets: corner(p) })) },
      CENTERS: {
        pieces: Array.from({ length: 6 }, () => ({ facelets: ["regular", "regular", "regular", "regular"] })),
      },
    },
  };
}

/**
 * Roux "both blocks built" view — used by CMLL and the Roux-specific
 * Practice groups (Second Block Last Slot). Always hides the front/back
 * D-layer edges (DF=4, DB=6 — they belong to neither the left nor right
 * block) and every center except L/R (the two that anchor the visible
 * blocks). The 4 U-layer edges (0-3) are always hidden too — edge position
 * is never relevant to either group. `hideTopCorners` additionally hides
 * the 4 U-layer corners: CMLL keeps them (they're its actual target), but
 * Second Block Last Slot hides them too — that piece is still scrambled at
 * this stage, so showing it would be misleading, not helpful.
 *
 * The centers other than L/R are only DIMMED by default (context, as in
 * CMLL); `hideOtherCenters` blanks them instead — Second Block Last Slot's
 * algs turn r/M, which moves those centers, so their position means nothing
 * there.
 */
export function rouxBlocksStickeringMask(hideTopCorners: boolean, hideOtherCenters = false): StickeringMaskOrbits {
  const edge = (p: number): FaceletMask => ([0, 1, 2, 3, 4, 6].includes(p) ? "ignored" : "regular");
  const corner = (p: number): FaceletMask => (hideTopCorners && p <= 3 ? "ignored" : "regular");
  const center = (p: number): FaceletMask => (p === 1 || p === 3 ? "regular" : hideOtherCenters ? "ignored" : "dim");
  return {
    orbits: {
      EDGES: { pieces: Array.from({ length: 12 }, (_, p) => ({ facelets: [edge(p), edge(p)] })) },
      CORNERS: { pieces: Array.from({ length: 8 }, (_, p) => ({ facelets: [corner(p), corner(p), corner(p)] })) },
      CENTERS: {
        pieces: Array.from({ length: 6 }, (_, p) => ({ facelets: [center(p), center(p), center(p), center(p)] })),
      },
    },
  };
}
