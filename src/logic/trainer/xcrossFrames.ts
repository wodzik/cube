/**
 * The four F2L slots of a cross on U (the app's scramble frame: white up,
 * green front) — their corner and middle-layer edge, in cubing's slot order
 * (the Practice group mask picker's "slot" piece groups).
 */

import type { Face } from "../stageDetection/lastLayerShared";

export type XCrossSlot = "FR" | "BR" | "FL" | "BL";
export const XCROSS_SLOTS: readonly XCrossSlot[] = ["FR", "BR", "FL", "BL"];

/** The cross face the slots are named for. */
export const XCROSS_CROSS_FACE: Face = "U";

export interface XCrossSlotFrame {
  /** CORNERS orbit slot index of the slot's corner. */
  cornerSlot: number;
  /** EDGES orbit slot index of the slot's middle-layer edge. */
  edgeSlot: number;
}

// CORNERS: 0=URF 1=UBR 2=ULB 3=UFL — EDGES: 8=FR 9=FL 10=BR 11=BL
export const XCROSS_SLOT_FRAMES: Record<XCrossSlot, XCrossSlotFrame> = {
  FR: { cornerSlot: 0, edgeSlot: 8 },
  BR: { cornerSlot: 1, edgeSlot: 10 },
  FL: { cornerSlot: 3, edgeSlot: 9 },
  BL: { cornerSlot: 2, edgeSlot: 11 },
};

/** Two slots (XXCross), e.g. "FR+BR". */
export type XXCrossPair = "FR+BR" | "FR+FL" | "BR+BL" | "FL+BL" | "FR+BL" | "BR+FL";
