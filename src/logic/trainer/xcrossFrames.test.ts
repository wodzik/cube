import { describe, it, expect } from "bun:test";
import { cube3x3x3 } from "cubing/puzzles";
import {
  XCROSS_SLOT_FRAMES,
  XCROSS_SLOTS,
  XCROSS_CROSS_FACE,
  conjugateFaceTurns,
  invertRotation,
} from "./xcrossFrames";
import { FACE_SLOTS, MIDDLE_LAYER_EDGE_SLOTS } from "../stageDetection/lastLayerShared";

describe("XCROSS_SLOT_FRAMES", () => {
  it("slot corner/edge pairs match the shared F2L pairing tables for the cross face", () => {
    const corners = FACE_SLOTS[XCROSS_CROSS_FACE].cornerSlots;
    const edges = MIDDLE_LAYER_EDGE_SLOTS[XCROSS_CROSS_FACE];
    for (const slot of XCROSS_SLOTS) {
      const frame = XCROSS_SLOT_FRAMES[slot];
      const i = corners.indexOf(frame.cornerSlot);
      expect(i).toBeGreaterThanOrEqual(0);
      // Positionally-paired corner and middle edge must belong to the same slot.
      expect(edges[i]).toBe(frame.edgeSlot);
    }
  });

  it("each slot's rotation maps the native D/BL target onto exactly that slot", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    // A state with the native target solved and everything else moved.
    // Native target = D cross (edges 4..7) + DBL corner + BL edge; R and U
    // turns never touch any of those pieces, so an R/U-only sequence
    // scrambles plenty while leaving the native target intact.
    const nativeSolved = "R U R' U' R U2 R' U";
    for (const slot of XCROSS_SLOTS) {
      const { rotation, cornerSlot, edgeSlot } = XCROSS_SLOT_FRAMES[slot];
      const conj = kpuzzle
        .defaultPattern()
        .applyAlg(`${invertRotation(rotation)} ${nativeSolved} ${rotation}`);
      const edges = conj.patternData.EDGES;
      const corners = conj.patternData.CORNERS;
      // U cross intact…
      for (const e of FACE_SLOTS.U.edgeSlots) {
        expect(edges.pieces[e]).toBe(e);
        expect(edges.orientation[e]).toBe(0);
      }
      // …this slot's pair intact…
      expect(corners.pieces[cornerSlot]).toBe(cornerSlot);
      expect(corners.orientation[cornerSlot]).toBe(0);
      expect(edges.pieces[edgeSlot]).toBe(edgeSlot);
      expect(edges.orientation[edgeSlot]).toBe(0);
    }
  });

  it("conjugateFaceTurns matches kpuzzle transformation algebra", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const slot of XCROSS_SLOTS) {
      const rot = XCROSS_SLOT_FRAMES[slot].rotation;
      const seq = ["R", "U'", "F2", "D", "B'", "L2"];
      const mapped = conjugateFaceTurns(kpuzzle, seq, rot);
      const direct = kpuzzle.algToTransformation(`${invertRotation(rot)} ${seq.join(" ")} ${rot}`);
      expect(kpuzzle.algToTransformation(mapped.join(" ")).isIdentical(direct)).toBe(true);
    }
  });

  it("invertRotation inverts", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const rot of ["z2", "z2 y", "z2 y2", "z2 y'"]) {
      const t = kpuzzle.algToTransformation(`${rot} ${invertRotation(rot)}`);
      expect(t.isIdentical(kpuzzle.identityTransformation())).toBe(true);
    }
  });
});
