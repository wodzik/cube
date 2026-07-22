/**
 * Composable, predefined piece-groups for the Practice group/case mask
 * picker — each is a named toggle contributing a set of edge/corner piece
 * indices; the picker unions whichever ones are selected and builds one
 * StickeringMaskOrbits via trainerMasks.ts's pieceMask (same builder the
 * Case Trainer's masks already use). E.g. "top-layer edges" + "back-left
 * F2L slot" selected together shows exactly those pieces, dims everything
 * else — no reason to duplicate pieceMask's logic here.
 *
 * PURE — no React, no side-effects.
 */

import { FACE_SLOTS } from "./stageDetection/lastLayerShared";
import { XCROSS_SLOT_FRAMES, type XCrossSlot } from "./trainer/xcrossFrames";
import { pieceMask } from "./trainer/trainerMasks";
import type { StickeringMaskOrbits } from "../types/cube";

export interface MaskPieceGroup {
  id: string;
  label: string;
  edges: number[];
  corners: number[];
}

const F2L_SLOTS: readonly XCrossSlot[] = ["FR", "FL", "BR", "BL"];

/** The full predefined vocabulary, in display order. */
export const MASK_PIECE_GROUPS: MaskPieceGroup[] = [
  { id: "u-edges", label: "Top edges", edges: FACE_SLOTS.U.edgeSlots, corners: [] },
  { id: "u-corners", label: "Top corners", edges: [], corners: FACE_SLOTS.U.cornerSlots },
  { id: "d-edges", label: "Bottom edges", edges: FACE_SLOTS.D.edgeSlots, corners: [] },
  { id: "d-corners", label: "Bottom corners", edges: [], corners: FACE_SLOTS.D.cornerSlots },
  ...F2L_SLOTS.map((slot) => ({
    id: `f2l-${slot.toLowerCase()}`,
    label: `F2L ${slot}`,
    edges: [XCROSS_SLOT_FRAMES[slot].edgeSlot],
    corners: [XCROSS_SLOT_FRAMES[slot].cornerSlot],
  })),
];

const BY_ID = new Map(MASK_PIECE_GROUPS.map((g) => [g.id, g]));

/** Union the selected piece-groups' pieces and build one mask (unknown ids are ignored). */
export function buildMaskFromPieceGroups(ids: readonly string[]): StickeringMaskOrbits {
  const edges = new Set<number>();
  const corners = new Set<number>();
  for (const id of ids) {
    const g = BY_ID.get(id);
    if (!g) continue;
    g.edges.forEach((e) => edges.add(e));
    g.corners.forEach((c) => corners.add(c));
  }
  return pieceMask(edges, corners);
}
