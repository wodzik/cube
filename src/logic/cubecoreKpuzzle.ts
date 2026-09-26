/**
 * A cubecore State (the smart cube's tracked state) as a cubing.js
 * KTransformation from solved — for the older trainer code that still works
 * on cubing.js puzzles (CaseTrainerPage's engines and detection).
 *
 * Slot orders as in logic/cubecoreMask.ts (verified against cubing.js by
 * cubecoreKpuzzle.test.ts); centres are left untwisted (a state can't tell
 * how often a centre turned — nothing here reads centre orientation).
 */

import { type KPuzzle, KTransformation } from "cubing/kpuzzle";
import { FACELETS, type State, type Vec3 } from "@cubecore/core";

const EDGES = ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL"];
const CORNERS = ["UFR", "URB", "UBL", "ULF", "DRF", "DFL", "DLB", "DBR"];

const NORMAL: Record<string, Vec3> = Object.fromEntries(FACELETS.filter((f) => f.index % 9 === 4).map((f) => [f.face, f.normal]));
const same = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
function faceletsOf(name: string): number[] {
  const pos = [...name].reduce<Vec3>((p, c) => [p[0] + NORMAL[c][0], p[1] + NORMAL[c][1], p[2] + NORMAL[c][2]], [0, 0, 0]);
  return [...name].map((face) => FACELETS.find((x) => x.face === face && same(x.pos, pos))!.index);
}
const EDGE_FACELETS = EDGES.map(faceletsOf);
const CORNER_FACELETS = CORNERS.map(faceletsOf);

function orbit(state: State, slots: number[][]) {
  const permutation: number[] = [];
  const orientationDelta: number[] = [];
  for (const slot of slots) {
    // The sticker on the slot's first facelet: which piece it belongs to, and which of its stickers.
    const sticker = state[slot[0]];
    const piece = slots.findIndex((s) => s.includes(sticker));
    permutation.push(piece);
    orientationDelta.push(slots[piece].indexOf(sticker));
  }
  return { permutation, orientationDelta };
}

export function stateToKTransformation(kp: KPuzzle, state: State): KTransformation {
  return new KTransformation(kp, {
    EDGES: orbit(state, EDGE_FACELETS),
    CORNERS: orbit(state, CORNER_FACELETS),
    CENTERS: { permutation: [0, 1, 2, 3, 4, 5], orientationDelta: [0, 0, 0, 0, 0, 0] },
  });
}
