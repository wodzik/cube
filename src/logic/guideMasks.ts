/**
 * Stickering masks for the Academy guides' cube demos (data/guides).
 *
 * Guide demos are shown in the "z2" frame — the setup alg starts with z2,
 * so the WHITE cross sits on the BOTTOM and yellow on top, the way a solver
 * holds the cube — while cubing.js's piece indices stay the default (U-layer
 * pieces 0-3 are the WHITE ones, D-layer pieces 4-7 the YELLOW ones). Masks
 * follow PIECES, not positions, so "the last layer" here means the D-index
 * pieces even though they're on top of the picture. That's the whole reason
 * this file exists next to trainerMasks.academyStepMask (which is written
 * for the un-rotated frame).
 *
 * The first two layers are NEVER dimmed, in any view: a solved (or
 * being-solved) F2L in full colour is what the reader actually sees on
 * their cube, and it's what "match the centres" recognition refers to.
 * Pieces that don't matter for the current step are greyed out with
 * "ignored" — never "dim", which renders as darkened colours that read as
 * a dirty cube rather than as "not relevant".
 *
 * The spatial FRONT-RIGHT slot in the z2 frame holds the pieces cubing.js
 * calls UFL (corner 3) and FL (edge 9) — see F2L_PAIR below.
 */

import type { FaceletMask, StickeringMaskOrbits } from "../types/cube";

export type GuideMaskKind =
  /** Only the 4 white edges + centers — the cross step. */
  | "cross"
  /** White layer (cross + corners) + centers. */
  | "first-layer"
  /** White cross + the one front-right middle edge (F2L_PAIR.edge) — no corners at all. For "insert the edges before any corner exists" scenes (Zeta Slotting). */
  | "cross-edge"
  /** First two layers in color, last layer greyed out — cubing.js's "F2L" stickering look. */
  | "f2l"
  /** Same as "f2l" in the guides — kept as a distinct kind so the F2L guide can be re-styled later without touching layer-by-layer. */
  | "f2l-pair"
  /** Last-layer corners show only their yellow sticker; LL edges hidden — the orient-corners look. */
  | "ll-corners-orient"
  /** Classic OLL look: LL pieces show only their yellow sticker. */
  | "ll-orient"
  /** LL corners in full color, LL edges hidden — the permute-corners look. */
  | "ll-corners"
  /** Whole last layer in full color. */
  | "ll"
  | "full";

const WHITE_EDGES = new Set([0, 1, 2, 3]);
const WHITE_CORNERS = new Set([0, 1, 2, 3]);
const YELLOW_EDGES = new Set([4, 5, 6, 7]);
const YELLOW_CORNERS = new Set([4, 5, 6, 7]);
const MIDDLE_EDGES = new Set([8, 9, 10, 11]);
/** Front-right slot in the z2 frame (see file comment). */
const F2L_PAIR = { corner: 3, edge: 9 };

const REG: FaceletMask = "regular";
const OFF: FaceletMask = "ignored";

export function guideMask(kind: GuideMaskKind): StickeringMaskOrbits {
  const edge = (p: number): FaceletMask[] => {
    const yellow = YELLOW_EDGES.has(p);
    switch (kind) {
      case "full":
      case "ll":
        return [REG, REG];
      case "cross":
      case "first-layer":
        return WHITE_EDGES.has(p) ? [REG, REG] : [OFF, OFF];
      case "cross-edge":
        return WHITE_EDGES.has(p) || p === F2L_PAIR.edge ? [REG, REG] : [OFF, OFF];
      case "f2l":
      case "f2l-pair":
        return yellow ? [OFF, OFF] : [REG, REG];
      case "ll-corners-orient":
      case "ll-corners":
        return yellow ? [OFF, OFF] : [REG, REG];
      case "ll-orient":
        return yellow ? [REG, OFF] : [REG, REG];
    }
  };
  const corner = (p: number): FaceletMask[] => {
    const yellow = YELLOW_CORNERS.has(p);
    switch (kind) {
      case "full":
      case "ll":
      case "ll-corners":
        return [REG, REG, REG];
      case "cross":
        return [OFF, OFF, OFF];
      case "first-layer":
        return WHITE_CORNERS.has(p) ? [REG, REG, REG] : [OFF, OFF, OFF];
      case "cross-edge":
        return [OFF, OFF, OFF];
      case "f2l":
      case "f2l-pair":
        return yellow ? [OFF, OFF, OFF] : [REG, REG, REG];
      case "ll-corners-orient":
      case "ll-orient":
        return yellow ? [REG, OFF, OFF] : [REG, REG, REG];
    }
  };
  return {
    orbits: {
      EDGES: { pieces: Array.from({ length: 12 }, (_, p) => ({ facelets: edge(p) })) },
      CORNERS: { pieces: Array.from({ length: 8 }, (_, p) => ({ facelets: corner(p) })) },
      // Centers always in color (the reader matches pieces against them); 4 facelets each — see trainerMasks.pieceMask.
      CENTERS: { pieces: Array.from({ length: 6 }, () => ({ facelets: [REG, REG, REG, REG] })) },
    },
  };
}

/** Exported for tests — which pieces a mask kind is "about". */
export const GUIDE_MASK_GROUPS = { WHITE_EDGES, WHITE_CORNERS, YELLOW_EDGES, YELLOW_CORNERS, MIDDLE_EDGES, F2L_PAIR };
