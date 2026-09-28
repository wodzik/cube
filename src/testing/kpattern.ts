/**
 * Test-only: cubing.js's KPattern view of a cube (patternData.CORNERS /
 * EDGES / CENTERS — pieces and orientation per slot), computed from a
 * cubecore state. The content tests (guides, Academy) read pieces this way;
 * this keeps them without cubing.js. Slot order and the orientation
 * convention are cubing's (the sticker at facelet k of a slot is its piece's
 * (k − orientation) mod n) — checked against cubing itself when it was
 * still a dependency.
 */

import { FACELETS, type State, applyMoves, isSolved, solvedState } from "@wodzik/cubecore/core";

const CORNERS = ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"];
const EDGES = ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL"];
const CENTERS = ["U", "L", "F", "R", "B", "D"];

const NORMAL: Record<string, readonly number[]> = Object.fromEntries(FACELETS.filter((f) => f.index % 9 === 4).map((f) => [f.face, f.normal]));
function faceletOf(name: string, k: number): number {
  const pos = [...name].reduce((p, c) => [p[0] + NORMAL[c][0], p[1] + NORMAL[c][1], p[2] + NORMAL[c][2]], [0, 0, 0]);
  const f = FACELETS.find((x) => x.face === name[k] && x.pos[0] === pos[0] && x.pos[1] === pos[1] && x.pos[2] === pos[2]);
  if (!f) throw new Error(`No facelet ${name}[${k}]`);
  return f.index;
}

/** Home facelet → (piece, which of its stickers). */
const HOME = new Map<number, { piece: number; j: number }>();
for (const names of [CORNERS, EDGES]) names.forEach((name, piece) => [...name].forEach((_, j) => HOME.set(faceletOf(name, j), { piece, j })));

function orbit(state: State, names: readonly string[]) {
  const pieces: number[] = [];
  const orientation: number[] = [];
  names.forEach((name) => {
    const { piece, j } = HOME.get(state[faceletOf(name, 0)])!;
    pieces.push(piece);
    orientation.push((name.length - j) % name.length);
  });
  return { pieces, orientation };
}

export class KPattern {
  constructor(readonly state: State) {}
  applyAlg(alg: string): KPattern {
    return new KPattern(alg.trim() ? applyMoves(this.state, alg) : this.state);
  }
  get patternData() {
    const centres = CENTERS.map((f) => CENTERS.indexOf("URFDLB"[Math.floor(this.state[faceletOf(f, 0)] / 9)]));
    return {
      CORNERS: orbit(this.state, CORNERS),
      EDGES: orbit(this.state, EDGES),
      CENTERS: { pieces: centres, orientation: centres.map(() => 0) },
    };
  }
  /** The same cube, sticker for sticker (orientation included). */
  isIdentical(other: KPattern): boolean {
    return this.state.every((v, i) => v === other.state[i]);
  }
  /** Solved, however the whole cube is turned (cubing's ignorePuzzleOrientation / ignoreCenterOrientation). */
  experimentalIsSolved(_options?: unknown): boolean {
    return isSolved(this.state);
  }
}

export const kpuzzle = { defaultPattern: () => new KPattern(solvedState()) };
