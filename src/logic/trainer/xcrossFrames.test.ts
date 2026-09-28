import { describe, it, expect } from "bun:test";
import {
  XCROSS_SLOT_FRAMES,
  XCROSS_SLOTS,
  XCROSS_CROSS_FACE,
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
});
