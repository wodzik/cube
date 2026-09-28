import { describe, expect, it } from "bun:test";
import { samePiece, swapToTarget } from "@wodzik/cubecore/bld";
import { applyMoves, solvedState, statesEqual } from "@wodzik/cubecore/core";
import { BLD_METHODS, letterPosition, solvePair, targetLetters } from "./bld";

describe("blindfolded letters", () => {
  for (const method of Object.values(BLD_METHODS)) {
    it(`${method.name}: every pair leaves exactly buffer → X → Y`, () => {
      const letters = targetLetters(method);
      let pairs = 0;
      const bad: string[] = [];
      for (const a of letters)
        for (const b of letters) {
          const pa = letterPosition(method, a);
          const pb = letterPosition(method, b);
          if (samePiece(method.kind, pa, pb)) continue;
          const [x, y] = solvePair(method, a, b);
          const got = applyMoves(solvedState(), `${x.full} ${y.full}`);
          const want = swapToTarget(swapToTarget(solvedState(), method.kind, pa, method.buffer), method.kind, pb, method.buffer);
          if (!statesEqual(got, want)) bad.push(a + b);
          pairs++;
        }
      expect(bad).toEqual([]);
      expect(pairs).toBeGreaterThan(300);
    });
  }
});

import { parseDecoratedAlg, BLINDFOLDED } from "./academy";
import { JA_PERM, JB_PERM, M2_EDGES, M2_PARITY, MODIFIED_Y, RA_PARITY, T_PERM } from "./bld";
describe("the Blindfolded lesson uses data/bld.ts's algorithms", () => {
  it("same moves", () => {
    const plain = (step: string, id: string) => parseDecoratedAlg(BLINDFOLDED.steps.find((s) => s.id === step)!.algs.find((a) => a.id === id)!.alg).tokens.join(" ");
    expect(plain("op-edges", "t-perm")).toBe(T_PERM);
    expect(plain("op-edges", "ja-perm")).toBe(JA_PERM);
    expect(plain("op-edges", "jb-perm")).toBe(JB_PERM);
    expect(plain("op-edges", "parity")).toBe(RA_PARITY);
    expect(plain("op-corners", "y-perm")).toBe(MODIFIED_Y);
    expect(plain("m2", "parity")).toBe(M2_PARITY);
    expect(plain("m2", "uf")).toBe(M2_EDGES.direct.C.alg);
    expect(plain("m2", "db")).toBe(M2_EDGES.direct.W.alg);
    expect(plain("m2", "fu")).toBe(M2_EDGES.direct.I.alg);
    expect(plain("m2", "bd")).toBe(M2_EDGES.direct.S.alg);
    expect(plain("m2", "bu")).toBe(M2_EDGES.direct.Q.alg);
  });
});

import { CORNER_STICKER, EDGE_STICKER, OP_CORNERS, OP_EDGES } from "./bld";
describe("sticker names match the scheme's positions", () => {
  it("the first face letter is the face the sticker is on", () => {
    const FACE = "URFDLB";
    for (const [l, n] of Object.entries(EDGE_STICKER)) expect(`${l} ${FACE[Math.floor(letterPosition(OP_EDGES, l) / 9)]}`).toBe(`${l} ${n[0]}`);
    for (const [l, n] of Object.entries(CORNER_STICKER)) expect(`${l} ${FACE[Math.floor(letterPosition(OP_CORNERS, l) / 9)]}`).toBe(`${l} ${n[0]}`);
  });
  it("stickers named on the same piece are on the same piece", () => {
    const key = (n: string) => n.split("").sort().join("");
    for (const a of Object.keys(EDGE_STICKER))
      for (const b of Object.keys(EDGE_STICKER))
        expect(`${a}${b} ${samePiece("edge", letterPosition(OP_EDGES, a), letterPosition(OP_EDGES, b))}`).toBe(`${a}${b} ${key(EDGE_STICKER[a]) === key(EDGE_STICKER[b])}`);
    for (const a of Object.keys(CORNER_STICKER))
      for (const b of Object.keys(CORNER_STICKER))
        expect(`${a}${b} ${samePiece("corner", letterPosition(OP_CORNERS, a), letterPosition(OP_CORNERS, b))}`).toBe(`${a}${b} ${key(CORNER_STICKER[a]) === key(CORNER_STICKER[b])}`);
  });
});

import { setupDone, setupLetters } from "./bld";
describe("the setups drill check", () => {
  it("every table setup counts; the swap alone or a move off the rule doesn't", () => {
    for (const method of Object.values(BLD_METHODS)) {
      for (const l of setupLetters(method)) {
        const ok = applyMoves(solvedState(), method.setups[l]);
        expect(`${method.id} ${l} ${setupDone(method, solvedState(), ok, l)}`).toBe(`${method.id} ${l} true`);
        expect(`${method.id} ${l} untouched ${setupDone(method, solvedState(), solvedState(), l)}`).toBe(`${method.id} ${l} untouched false`);
      }
    }
    // A move that brings the sticker but disturbs the buffer doesn't count (U: UB → UL, but UR moves too).
    expect(setupDone(OP_EDGES, solvedState(), applyMoves(solvedState(), "U'"), "A")).toBe(false);
    // Another setup than the table's counts: X (DL) is L2 in the table; l' L' does it with a wide move (the core turns — another frame).
    expect(setupDone(OP_EDGES, solvedState(), applyMoves(solvedState(), "l' L'"), "X")).toBe(true);
  });
});
