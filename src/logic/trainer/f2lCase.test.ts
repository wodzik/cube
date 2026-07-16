import { describe, it, expect } from "bun:test";
import { cube3x3x3 } from "cubing/puzzles";
import { FACE_SLOTS } from "../stageDetection/lastLayerShared";
import { XCROSS_SLOT_FRAMES, XCROSS_SLOTS } from "./xcrossFrames";
import { f2lCasePattern, sampleF2LCase } from "./f2lCase";

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

describe("f2lCase", () => {
  it("samples are never fully solved in the slot and never on the cross", () => {
    for (const slot of XCROSS_SLOTS) {
      const frame = XCROSS_SLOT_FRAMES[slot];
      for (let i = 0; i < 300; i++) {
        const s = sampleF2LCase(slot);
        expect(CROSS_EDGES.includes(s.edgePos)).toBe(false);
        const solved = s.cornerPos === frame.cornerSlot && s.cornerOri === 0 && s.edgePos === frame.edgeSlot && s.edgeOri === 0;
        expect(solved).toBe(false);
      }
    }
  });

  it("patterns satisfy the cube's laws and keep the cross + other slots' constraints", () => {
    for (const slot of XCROSS_SLOTS) {
      const frame = XCROSS_SLOT_FRAMES[slot];
      for (let i = 0; i < 200; i++) {
        const spec = sampleF2LCase(slot);
        const p = f2lCasePattern(kpuzzle, slot, spec).patternData;

        // Laws: orientation sums + matching permutation parities.
        expect(p.CORNERS.orientation.reduce((a, b) => a + b, 0) % 3).toBe(0);
        expect(p.EDGES.orientation.reduce((a, b) => a + b, 0) % 2).toBe(0);
        expect(permutationParity([...p.CORNERS.pieces])).toBe(permutationParity([...p.EDGES.pieces]));

        // Cross stays untouched.
        for (const e of CROSS_EDGES) {
          expect(p.EDGES.pieces[e]).toBe(e);
          expect(p.EDGES.orientation[e]).toBe(0);
        }

        // The trained pieces sit exactly where the spec put them.
        expect(p.CORNERS.pieces[spec.cornerPos]).toBe(frame.cornerSlot);
        expect(p.CORNERS.orientation[spec.cornerPos]).toBe(spec.cornerOri);
        expect(p.EDGES.pieces[spec.edgePos]).toBe(frame.edgeSlot);
        expect(p.EDGES.orientation[spec.edgePos]).toBe(spec.edgeOri);

        // Centers home.
        expect(p.CENTERS.pieces.join()).toBe("0,1,2,3,4,5");
      }
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
