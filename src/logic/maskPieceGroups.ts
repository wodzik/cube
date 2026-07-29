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

export interface CenterGroup {
  id: string;
  label: string;
  index: number;
}

/**
 * CENTERS orbit indices, one per face — U=0 and L=1 are existing, verified
 * constants (trainerMasks.ts's academyStepMask U_CENTER, rouxTargets.ts's
 * ORANGE_CENTER); F/R/B/D confirmed live via Debug > Try Algorithm's mask
 * JSON override (isolating each index in turn against an all-invisible
 * cube: 2=green/F, 3=red/R, 4=hidden-from-default-camera/B, 5=yellow/D on
 * the flattened net) — matches cubing.js's standard U,L,F,R,B,D kpuzzle
 * center-orbit order.
 */
export const CENTER_GROUPS: CenterGroup[] = [
  { id: "center-u", label: "Top center", index: 0 },
  { id: "center-l", label: "Left center", index: 1 },
  { id: "center-f", label: "Front center", index: 2 },
  { id: "center-r", label: "Right center", index: 3 },
  { id: "center-b", label: "Back center", index: 4 },
  { id: "center-d", label: "Bottom center", index: 5 },
];

const CENTER_BY_ID = new Map(CENTER_GROUPS.map((g) => [g.id, g]));

/**
 * Union the selected piece-groups' pieces and build one mask (unknown ids
 * are ignored). `hiddenCenters` (CenterGroup ids) force those specific
 * centers hidden regardless of `showCenters` — e.g. an F2L-style mask that
 * shows most centers as an orientation reference but keeps the last layer
 * (its center included) fully blank.
 */
export function buildMaskFromPieceGroups(
  ids: readonly string[],
  showCenters = false,
  hiddenCenters: readonly string[] = []
): StickeringMaskOrbits {
  const edges = new Set<number>();
  const corners = new Set<number>();
  for (const id of ids) {
    const g = BY_ID.get(id);
    if (!g) continue;
    g.edges.forEach((e) => edges.add(e));
    g.corners.forEach((c) => corners.add(c));
  }
  const mask = pieceMask(edges, corners, undefined, showCenters);
  for (const id of hiddenCenters) {
    const g = CENTER_BY_ID.get(id);
    if (g) mask.orbits.CENTERS.pieces[g.index] = { facelets: ["ignored", "ignored", "ignored", "ignored"] };
  }
  return mask;
}
