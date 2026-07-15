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
import type { FaceletMask, StickeringMaskOrbits } from "../../types/cube";

function pieceMask(
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

/** Cross edges + the trained slot's corner/edge pair (also used by the free-pair trainer). */
export function xcrossStickeringMask(face: Face, slot: XCrossSlot): StickeringMaskOrbits {
  const frame = XCROSS_SLOT_FRAMES[slot];
  return pieceMask(
    new Set([...FACE_SLOTS[face].edgeSlots, frame.edgeSlot]),
    new Set([frame.cornerSlot])
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

/** Cross edges in full color; every other edge orientation-only. */
export function eocrossStickeringMask(face: Face): StickeringMaskOrbits {
  const crossEdges = new Set(FACE_SLOTS[face].edgeSlots);
  const others = new Set(Array.from({ length: 12 }, (_, i) => i).filter((i) => !crossEdges.has(i)));
  return pieceMask(crossEdges, new Set(), others);
}
