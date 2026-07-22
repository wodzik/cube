/**
 * Stickering masks for the Case Trainer's 3D view — show only the pieces
 * the current drill is about, so the view answers "where are my cross
 * pieces" at a glance instead of drowning them in a full scramble.
 *
 * Masks address PIECES (they follow a piece as it moves), using the same
 * verified orbit indexing as liveCubeState.ts. Centers stay dimmed for
 * orientation reference — a cross is only "solved" relative to its centers.
 */

import { FACE_SLOTS, type Face } from "../stageDetection/lastLayerShared";
import { XXCROSS_PAIR_FRAMES, XCROSS_SLOT_FRAMES, type XCrossSlot, type XXCrossPair } from "./xcrossFrames";
import type { LiveCubeState } from "../stageDetection/liveCubeState";
import type { FaceletMask, StickeringMaskOrbits } from "../../types/cube";

/** Exported for logic/maskPieceGroups.ts — the Practice group mask picker composes piece-groups the same way. */
export function pieceMask(
  visibleEdges: Set<number>,
  visibleCorners: Set<number>,
  /** Edges rendered orientation-only (EO trainers) instead of ignored. */
  orientedEdges: Set<number> = new Set()
): StickeringMaskOrbits {
  const edge = (piece: number): FaceletMask =>
    visibleEdges.has(piece) ? "regular" : orientedEdges.has(piece) ? "oriented" : "ignored";
  const corner = (piece: number): FaceletMask => (visibleCorners.has(piece) ? "regular" : "ignored");
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
        pieces: Array.from({ length: 6 }, () => ({ facelets: ["dim", "dim", "dim", "dim"] })),
      },
    },
  };
}

export function crossStickeringMask(face: Face): StickeringMaskOrbits {
  return pieceMask(new Set(FACE_SLOTS[face].edgeSlots), new Set());
}

export type AcademyView = "oll-corners" | "oll" | "corners" | "full";

/**
 * Academy step views (see data/academy.ts). ALL of them are MASKS — even
 * "full" — so a mounted player never has to switch from a mask back to a
 * named stickering (which TwistyPlayer can't do, see CubeVisualisation).
 *
 *  - "oll":         replica of cubing.js's named "OLL" stickering: F2L dim,
 *                   LL pieces show ONLY their primary (U-face) sticker —
 *                   facelets [regular, ignored, …] — U center regular.
 *  - "oll-corners": same, but LL edges fully blacked out — the
 *                   orient-corners look (corner orientation only).
 *  - "corners":     LL corners in FULL color (permutation visible), LL
 *                   edges blacked out, F2L dim — the permute-corners look.
 *  - "full":        plain cube.
 */
export function academyStepMask(view: AcademyView): StickeringMaskOrbits {
  const U_PIECES = new Set([0, 1, 2, 3]);
  const U_CENTER = 0;
  const edge = (p: number): ("regular" | "ignored" | "dim")[] => {
    if (view === "full") return ["regular", "regular"];
    if (!U_PIECES.has(p)) return ["dim", "dim"];
    if (view === "oll") return ["regular", "ignored"];
    return ["ignored", "ignored"]; // oll-corners, corners
  };
  const corner = (p: number): ("regular" | "ignored" | "dim")[] => {
    if (view === "full" || (view === "corners" && U_PIECES.has(p))) return ["regular", "regular", "regular"];
    if (!U_PIECES.has(p)) return ["dim", "dim", "dim"];
    return ["regular", "ignored", "ignored"]; // oll / oll-corners: primary sticker only
  };
  const center = (p: number): FaceletMask =>
    view === "full" || p === U_CENTER ? "regular" : "dim";
  return {
    orbits: {
      EDGES: { pieces: Array.from({ length: 12 }, (_, p) => ({ facelets: edge(p) })) },
      CORNERS: { pieces: Array.from({ length: 8 }, (_, p) => ({ facelets: corner(p) })) },
      CENTERS: {
        pieces: Array.from({ length: 6 }, (_, p) => ({
          facelets: [center(p), center(p), center(p), center(p)],
        })),
      },
    },
  };
}

/** Cross edges + the trained slot's corner/edge pair (also used by the free-pair trainer). */
export function xcrossStickeringMask(face: Face, slot: XCrossSlot): StickeringMaskOrbits {
  const frame = XCROSS_SLOT_FRAMES[slot];
  return pieceMask(
    new Set([...FACE_SLOTS[face].edgeSlots, frame.edgeSlot]),
    new Set([frame.cornerSlot])
  );
}

/** Cross edges + any number of trained slots' pairs (F2L multi-pair drills). */
export function multiSlotStickeringMask(face: Face, slots: readonly XCrossSlot[]): StickeringMaskOrbits {
  const frames = slots.map((s) => XCROSS_SLOT_FRAMES[s]);
  return pieceMask(
    new Set([...FACE_SLOTS[face].edgeSlots, ...frames.map((f) => f.edgeSlot)]),
    new Set(frames.map((f) => f.cornerSlot))
  );
}

/** Cross edges + both trained slots' pairs. */
export function xxcrossStickeringMask(face: Face, pair: XXCrossPair): StickeringMaskOrbits {
  const [s1, s2] = XXCROSS_PAIR_FRAMES[pair].slots;
  const f1 = XCROSS_SLOT_FRAMES[s1];
  const f2 = XCROSS_SLOT_FRAMES[s2];
  return pieceMask(
    new Set([...FACE_SLOTS[face].edgeSlots, f1.edgeSlot, f2.edgeSlot]),
    new Set([f1.cornerSlot, f2.cornerSlot])
  );
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
 */
export function rouxBlocksStickeringMask(hideTopCorners: boolean): StickeringMaskOrbits {
  const edge = (p: number): FaceletMask => ([0, 1, 2, 3, 4, 6].includes(p) ? "ignored" : "regular");
  const corner = (p: number): FaceletMask => (hideTopCorners && p <= 3 ? "ignored" : "regular");
  const center = (p: number): FaceletMask => (p === 1 || p === 3 ? "regular" : "dim");
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

/**
 * Cross edges in full color; every other edge orientation-only. Without
 * `liveState`, "orientation-only" is cubing.js's single static teal marker
 * (its "oriented" facelet colors every masked piece identically, regardless
 * of whether it's actually flipped correctly right now — see FaceletMask) —
 * used as a fallback for callers with no live cube state (e.g. a tab icon).
 * With `liveState`, each non-cross edge is colored per its ACTUAL current
 * orientation: teal ("oriented") if good, tan ("experimentalOriented2", the
 * other fixed marker color cubing.js exposes) if it still needs flipping —
 * real per-piece feedback, recomputed by the caller after every move.
 */
export function eocrossStickeringMask(face: Face, liveState?: LiveCubeState): StickeringMaskOrbits {
  const crossEdges = new Set(FACE_SLOTS[face].edgeSlots);
  if (!liveState) {
    const others = new Set(Array.from({ length: 12 }, (_, i) => i).filter((i) => !crossEdges.has(i)));
    return pieceMask(crossEdges, new Set(), others);
  }
  const orientation = liveState.patternData.EDGES.orientation;
  const edge = (p: number): FaceletMask => {
    if (crossEdges.has(p)) return "regular";
    return orientation[p] === 0 ? "oriented" : "experimentalOriented2";
  };
  return {
    orbits: {
      EDGES: { pieces: Array.from({ length: 12 }, (_, p) => ({ facelets: [edge(p), edge(p)] })) },
      CORNERS: { pieces: Array.from({ length: 8 }, () => ({ facelets: ["ignored", "ignored", "ignored"] })) },
      CENTERS: { pieces: Array.from({ length: 6 }, () => ({ facelets: ["dim", "dim", "dim", "dim"] })) },
    },
  };
}
