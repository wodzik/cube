import { describe, it, expect } from "bun:test";
import { cube3x3x3 } from "cubing/puzzles";
import { FACE_SLOTS } from "../stageDetection/lastLayerShared";
import { XCROSS_SLOT_FRAMES, XCROSS_SLOTS, type XCrossSlot } from "./xcrossFrames";
import { f2lCasePattern, sampleF2LCase, sampleF2LPlacements } from "./f2lCase";

const kpuzzle = await cube3x3x3.kpuzzle();
const CROSS_EDGES = FACE_SLOTS.U.edgeSlots;

function permutationParity(pieces: number[]): number {
  let parity = 0;
  const seen = new Set<number>();
  for (let i = 0; i < pieces.length; i++) {
    if (seen.has(i)) continue;
    let j = i;
    let len = 0;
    while (!seen.has(j)) {
      seen.add(j);
      j = pieces[j];
      len++;
    }
    parity ^= (len - 1) % 2;
  }
  return parity;
}

const SLOT_SETS: XCrossSlot[][] = [
  ["FR"],
  ["FR", "BL"],
  ["FR", "FL", "BR"],
  ["FR", "FL", "BR", "BL"],
];

describe("f2lCase", () => {
  it("samples are never fully solved in their slot, never on the cross, and positions are distinct", () => {
    for (const slots of SLOT_SETS) {
      for (let i = 0; i < 200; i++) {
        const ps = sampleF2LPlacements(slots);
        expect(new Set(ps.map((p) => p.edgePos)).size).toBe(slots.length);
        expect(new Set(ps.map((p) => p.cornerPos)).size).toBe(slots.length);
        for (const p of ps) {
          expect(CROSS_EDGES.includes(p.edgePos)).toBe(false);
          const frame = XCROSS_SLOT_FRAMES[p.slot];
          const solved = p.cornerPos === frame.cornerSlot && p.cornerOri === 0 && p.edgePos === frame.edgeSlot && p.edgeOri === 0;
          expect(solved).toBe(false);
        }
      }
    }
  });

  it("patterns satisfy the cube's laws, keep the cross, and place every trained piece as sampled", () => {
    for (const slots of SLOT_SETS) {
      for (let i = 0; i < 150; i++) {
        const ps = sampleF2LPlacements(slots);
        const p = f2lCasePattern(kpuzzle, ps).patternData;

        // Laws: orientation sums + matching permutation parities.
        expect(p.CORNERS.orientation.reduce((a, b) => a + b, 0) % 3).toBe(0);
        expect(p.EDGES.orientation.reduce((a, b) => a + b, 0) % 2).toBe(0);
        expect(permutationParity([...p.CORNERS.pieces])).toBe(permutationParity([...p.EDGES.pieces]));

        // Every position holds exactly one piece.
        expect([...p.CORNERS.pieces].sort((a, b) => a - b).join()).toBe("0,1,2,3,4,5,6,7");
        expect([...p.EDGES.pieces].sort((a, b) => a - b).join()).toBe("0,1,2,3,4,5,6,7,8,9,10,11");

        // Cross stays untouched.
        for (const e of CROSS_EDGES) {
          expect(p.EDGES.pieces[e]).toBe(e);
          expect(p.EDGES.orientation[e]).toBe(0);
        }

        // The trained pieces sit exactly where the placements put them.
        for (const pl of ps) {
          const frame = XCROSS_SLOT_FRAMES[pl.slot];
          expect(p.CORNERS.pieces[pl.cornerPos]).toBe(frame.cornerSlot);
          expect(p.CORNERS.orientation[pl.cornerPos]).toBe(pl.cornerOri);
          expect(p.EDGES.pieces[pl.edgePos]).toBe(frame.edgeSlot);
          expect(p.EDGES.orientation[pl.edgePos]).toBe(pl.edgeOri);
        }

        // Centers home.
        expect(p.CENTERS.pieces.join()).toBe("0,1,2,3,4,5");
      }
    }
  });

  it("single-pair back-compat wrapper works for all slots", () => {
    for (const slot of XCROSS_SLOTS) {
      const p = sampleF2LCase(slot);
      expect(p.slot).toBe(slot);
    }
  });

  it("positions cover the full allowed range over many samples", () => {
    const cornerSeen = new Set<number>();
    const edgeSeen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const s = sampleF2LCase("FR");
      cornerSeen.add(s.cornerPos);
      edgeSeen.add(s.edgePos);
    }
    expect(cornerSeen.size).toBe(8);
    expect(edgeSeen.size).toBe(8); // 12 minus the 4 cross slots
  });
});
