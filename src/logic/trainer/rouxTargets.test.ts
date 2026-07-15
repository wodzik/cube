import { describe, it, expect } from "bun:test";
import { cube3x3x3 } from "cubing/puzzles";
import { isFbSolved, isFbSsSolved, isFsSolved, isFbdrSolved, isCmllSolved, isEolrSolved, eolrGoalPatterns } from "./rouxTargets";
import { CubieCube, CubeUtil, Mask } from "../../vendor/roux/CubeLib";
import { FbSolver, SsSolver, FsSolver, FbdrSolver, Min2PhaseSolver } from "../../vendor/roux/Solver";

const SCRAMBLES = [
  "R U R' F2 D' L2 B U2 F D R2 B2 L U F2 D2 R B",
  "F L2 D R' B2 U F' D2 L B R2 F2 U' L2 D B2 R U'",
  "D2 B2 U L F' R D B' L2 F U2 R2 D' F L B2 U R2",
];
const PREMOVES = ["", "x", "x'", "x2"];

describe("roux trainer targets vs vendored solver", () => {
  it("applying a solver FB solution (any x premove) satisfies isFbSolved in kpuzzle", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const fb = FbSolver();
    for (const scr of SCRAMBLES) {
      const cube = new CubieCube().apply(scr);
      for (const pm of PREMOVES) {
        const sol = fb.solve(cube.apply(pm), 0, 11, 1)[0];
        expect(sol).toBeDefined();
        // Solutions may contain M/r moves — kpuzzle notation handles them.
        const pattern = kpuzzle.defaultPattern().applyAlg(`${scr} ${pm} ${sol.toString()}`);
        expect(isFbSolved(pattern)).toBe(true);
      }
      // and the scrambled state itself is not FB-solved
      expect(isFbSolved(kpuzzle.defaultPattern().applyAlg(scr))).toBe(false);
    }
  });

  it("applying a solver SS solution on an FB-solved state satisfies isFbSsSolved (FB kept)", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const fb = FbSolver();
    for (const [i, scr] of SCRAMBLES.entries()) {
      const side = i % 2 === 0 ? ("front" as const) : ("back" as const);
      const ss = SsSolver(side === "front");
      const cube = new CubieCube().apply(scr);
      const fbSol = fb.solve(cube, 0, 11, 1)[0].toString();
      const afterFb = cube.apply(fbSol);
      const ssSol = ss.solve(afterFb, 0, 14, 1)[0].toString();
      const pattern = kpuzzle.defaultPattern().applyAlg(`${scr} ${fbSol} ${ssSol}`);
      expect(isFbSsSolved(pattern, side)).toBe(true);
      expect(isFbSolved(pattern)).toBe(true);
      // before the SS solution, SS is (generically) not solved
      const before = kpuzzle.defaultPattern().applyAlg(`${scr} ${fbSol}`);
      expect(isFbSsSolved(before, side)).toBe(false);
    }
  });

  it("applying a solver FS solution (any x premove) satisfies isFsSolved for that side", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const side of ["front", "back"] as const) {
      const fs = FsSolver(side === "front");
      for (const scr of SCRAMBLES) {
        const cube = new CubieCube().apply(scr);
        for (const pm of PREMOVES) {
          const sol = fs.solve(cube.apply(pm), 0, 10, 1)[0];
          expect(sol).toBeDefined();
          const pattern = kpuzzle.defaultPattern().applyAlg(`${scr} ${pm} ${sol.toString()}`);
          expect(isFsSolved(pattern, side)).toBe(true);
        }
        expect(isFsSolved(kpuzzle.defaultPattern().applyAlg(scr), side)).toBe(false);
      }
    }
  });

  it("applying a solver FBDR solution on an FS-solved state satisfies isFbdrSolved", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const fbdr = FbdrSolver();
    const m2p = Min2PhaseSolver();
    for (const mask of [Mask.fs_back_mask, Mask.fs_front_mask]) {
      const cube = CubeUtil.get_random_with_mask(mask);
      const gen = m2p.solve(cube, 0, 0, 0)[0].inv().toString();
      const sol = fbdr.solve(cube, 0, 11, 1)[0].toString();
      const before = kpuzzle.defaultPattern().applyAlg(gen);
      const after = kpuzzle.defaultPattern().applyAlg(`${gen} ${sol}`);
      expect(isFbdrSolved(after)).toBe(true);
      expect(isFbSolved(after)).toBe(true);
      // an FS-solved-only state is (generically) neither FB- nor FBDR-solved
      expect(isFbdrSolved(before)).toBe(false);
    }
  });

  it("FS masks match the vendored piece indexing (fs_back random state has our back square solved)", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const m2p = Min2PhaseSolver();
    const backState = CubeUtil.get_random_with_mask(Mask.fs_back_mask);
    const genBack = m2p.solve(backState, 0, 0, 0)[0].inv().toString();
    expect(isFsSolved(kpuzzle.defaultPattern().applyAlg(genBack), "back")).toBe(true);
    const frontState = CubeUtil.get_random_with_mask(Mask.fs_front_mask);
    const genFront = m2p.solve(frontState, 0, 0, 0)[0].inv().toString();
    expect(isFsSolved(kpuzzle.defaultPattern().applyAlg(genFront), "front")).toBe(true);
  });

  it("CMLL cases from the vendored alg list round-trip through isCmllSolved", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const { CMLL_ALGS } = await import("../../vendor/roux/cmllAlgs");
    expect(CMLL_ALGS.length).toBe(42);
    for (const [, alg] of CMLL_ALGS.slice(0, 6)) {
      const inv = alg.split(" ").reverse().map((t) => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith("2") ? t : `${t}'`)).join(" ");
      const scrambled = kpuzzle.defaultPattern().applyAlg(inv);
      expect(isCmllSolved(scrambled)).toBe(false);
      expect(isCmllSolved(scrambled.applyAlg(alg))).toBe(true);
    }
  });

  it("EOLR goal states are detected; plain solved and random LSE are not", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const goals = eolrGoalPatterns(kpuzzle);
    expect(goals.length).toBe(16);
    for (const gen of ["U' M2", "M' U M2 U2", "U M2 U'"]) {
      expect(isEolrSolved(kpuzzle.defaultPattern().applyAlg(gen), goals)).toBe(true);
    }
    expect(isEolrSolved(kpuzzle.defaultPattern(), goals)).toBe(false);
    expect(isEolrSolved(kpuzzle.defaultPattern().applyAlg("M U M' U M U2 M"), goals)).toBe(false);
  });

  it("smart-cube M-move reporting (opposite face-turn pair) keeps a solved FB detected", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    // A physical M reaches the log as an L + opposite-direction R pair; the
    // blocks are then rotated about the L-R axis vs their home slots — the
    // x^k offset tolerance must still accept them.
    for (const reportedSlice of ["L R'", "L' R", "L2 R2", "L R' L R'"]) {
      const pattern = kpuzzle.defaultPattern().applyAlg(reportedSlice);
      expect(isFbSolved(pattern)).toBe(true);
      expect(isFbSsSolved(pattern, "front")).toBe(true);
    }
    // …but a genuinely block-breaking move is rejected
    expect(isFbSolved(kpuzzle.defaultPattern().applyAlg("L U"))).toBe(false);
  });
});
