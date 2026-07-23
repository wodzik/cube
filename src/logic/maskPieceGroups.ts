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

import { FACE_SLOTS, MIDDLE_LAYER_EDGE_SLOTS } from "./stageDetection/lastLayerShared";
import { pieceMask } from "./trainer/trainerMasks";
import type { StickeringMaskOrbits } from "../types/cube";

export interface MaskPieceGroup {
  id: string;
  label: string;
  edges: number[];
  corners: number[];
}

type F2LSlot = "FR" | "FL" | "BR" | "BL";

/**
 * F2L slot corner+edge pairs, in the D-CROSS frame — every F2L algorithm
 * case in this app (Practice > F2L, and any group reusing these ids, e.g.
 * CMLL/Second Block Last Slot) is displayed and practiced with the cross
 * DOWN (D face fully shown; U stays masked/scrambled throughout, see the
 * group's own "named: F2L" cubing.js stickering) — NOT XCROSS_SLOT_FRAMES's
 * U-cross frame, which is calibrated for the separate xcross TRAINER tool
 * (a distinct feature that solves the cross on U instead). Using that table
 * here previously lit up a TOP-layer corner for e.g. "F2L FR", visibly
 * wrong against every actual F2L case's D-cross convention.
 *
 * Derived from FACE_SLOTS.D.cornerSlots positionally paired with
 * MIDDLE_LAYER_EDGE_SLOTS.D (see lastLayerShared.ts: index i's corner sits
 * directly above/below index i's middle edge) — the middle-layer edge
 * indices themselves (8=FR 9=FL 10=BR 11=BL) are frame-agnostic, same
 * physical pieces whichever face is "up".
 */
const F2L_SLOT_D_FRAME: Record<F2LSlot, { cornerSlot: number; edgeSlot: number }> = (() => {
  const slotOrder: readonly F2LSlot[] = ["FR", "FL", "BL", "BR"]; // matches lastLayerShared.ts's D-face comment
  const corners = FACE_SLOTS.D.cornerSlots;
  const edges = MIDDLE_LAYER_EDGE_SLOTS.D;
  const frame = {} as Record<F2LSlot, { cornerSlot: number; edgeSlot: number }>;
  slotOrder.forEach((slot, i) => {
    frame[slot] = { cornerSlot: corners[i], edgeSlot: edges[i] };
  });
  return frame;
})();

const F2L_SLOTS: readonly F2LSlot[] = ["FR", "FL", "BR", "BL"];

/** The full predefined vocabulary, in display order. */
export const MASK_PIECE_GROUPS: MaskPieceGroup[] = [
  { id: "u-edges", label: "Top edges", edges: FACE_SLOTS.U.edgeSlots, corners: [] },
  { id: "u-corners", label: "Top corners", edges: [], corners: FACE_SLOTS.U.cornerSlots },
  { id: "d-edges", label: "Bottom edges", edges: FACE_SLOTS.D.edgeSlots, corners: [] },
  { id: "d-corners", label: "Bottom corners", edges: [], corners: FACE_SLOTS.D.cornerSlots },
  ...F2L_SLOTS.map((slot) => ({
    id: `f2l-${slot.toLowerCase()}`,
    label: `F2L ${slot}`,
    edges: [F2L_SLOT_D_FRAME[slot].edgeSlot],
    corners: [F2L_SLOT_D_FRAME[slot].cornerSlot],
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
