import { describe, expect, it } from "bun:test";
import { formatAlg, frameFor, invert, parseAlg, transformMoves } from "@wodzik/cubecore/core";
import { F2L_CASES } from "@wodzik/cubecore/cfop";
import { cfopStageDetector, computeStageBoundaries, rouxStageDetector, startStateOf } from "./stageDetection/methodTracker";
import { solveCases } from "./solveCases";
import type { SolveRecord } from "../types/solve";

/** A solve of `segments` from the scramble that undoes them (moves one per written move, 100 ms apart). */
async function solveOf(segments: string[], method: "CFOP" | "Roux") {
  const all = segments.flatMap((s) => parseAlg(s));
  const scramble = formatAlg(invert(all));
  const moves = all.map((m, i) => ({ move: formatAlg([m]), relativeMs: i * 100 }));
  const start = startStateOf(scramble);
  const record = { id: `t-${Math.random()}`, scramble, moves, method } as unknown as SolveRecord;
  record.cfop = computeStageBoundaries(cfopStageDetector, moves, start);
  record.roux = computeStageBoundaries(rouxStageDetector, moves, start);
  return record;
}

describe("solveCases", () => {
  it("CFOP: the last pair's F2L case, then OLL and PLL", async () => {
    const pair = F2L_CASES[0];
    const sune = "R U R' U R U2 R'";
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const record = await solveOf([pair.algs.FR, sune, tPerm], "CFOP");
    const cases = solveCases(record, "CFOP");
    expect(cases["f2l-4"]).toMatchObject({ kind: "f2l", name: pair.id, slot: "FR" });
    expect(cases.oll).toMatchObject({ kind: "oll", name: "OLL 27" });
    expect(cases.pll).toMatchObject({ kind: "pll", name: "T" });
  });

  it("CFOP: colour neutral — the same cases with the cross on U", async () => {
    const pair = F2L_CASES[4];
    const onU = (alg: string) => formatAlg(transformMoves(parseAlg(alg), frameFor("U")));
    const record = await solveOf([onU(pair.algs.FL), onU("R U R' U R U2 R'"), onU("R U R' U' R' F R2 U' R' U' R U R' F'")], "CFOP");
    const cases = solveCases(record, "CFOP");
    expect(cases["f2l-4"]?.name).toBe(pair.id);
    expect(cases.oll?.name).toBe("OLL 27");
    expect(cases.pll?.name).toBe("T");
  });

  it("CFOP: a skipped PLL", async () => {
    const record = await solveOf(["R U R' U R U2 R'"], "CFOP");
    const cases = solveCases(record, "CFOP");
    expect(cases.oll?.name).toBe("OLL 27");
    expect(cases.pll?.name).toBe("skip");
  });

  it("Roux: the CMLL case", async () => {
    const record = await solveOf(["R U R' U R U2 R'"], "Roux");
    const cases = solveCases(record, "Roux");
    expect(cases.cmll?.kind).toBe("cmll");
    expect(cases.cmll?.name).toMatch(/Sune/);
  });

  it("other methods have no cases", async () => {
    const record = await solveOf(["R U R' U R U2 R'"], "CFOP");
    expect(solveCases(record, "LBL")).toEqual({});
  });

  it("how it was done: the case's algorithm its moves did, by effect", async () => {
    const record = await solveOf([F2L_CASES[0].algs.FR, "R U R' U R U2 R'", "R U R' U' R' F R2 U' R' U' R U R' F'"], "CFOP");
    const cases = solveCases(record, "CFOP");
    expect(cases.oll?.done).toMatchObject({ setup: 0 });
    expect(cases.oll?.done?.alg.replace(/[()]/g, "").replace(/\s+/g, " ").trim()).toBe("R U R' U R U2 R'");
    expect(cases.pll?.done).toMatchObject({ setup: 0 });
  });

  it("Advanced F2L: the BL pair's piece stuck in FR", async () => {
    // The BL pair goes in (extracting its piece from FR); the FR pair, still out, after it.
    const record = await solveOf(["R U R' U L U L'", F2L_CASES[0].algs.FR], "CFOP");
    const cases = solveCases(record, "CFOP");
    const last = Object.values(cases).find((c) => c.kind === "af2l");
    expect(last).toMatchObject({ kind: "af2l", slot: "BL" });
    expect(last?.name).toMatch(/^AF2L \d+/);
    expect(last?.subgroup).toBe("front-right");
  });

  it("a stuck piece taken out first: the case it became, after how many moves, and the algorithm after the extraction", () => {
    // A real solve (smart cube, face turns as reported): its second pair had a piece stuck in another slot.
    const moves = "U' R' R' B R L U' F F D F' D' F' R F D' F' R R' R' F D' F' D' F D' D' B D B' D F' D F D D L D L' R' D R D' R' D R D' R' D R R F L' F' L' R L' R B L B' B' B L' B' R L' D' L' D' D' L D' D' L' F L D L' D' L' F' L L D' D'".split(" ").map((move, i) => ({ move, relativeMs: i * 100 }));
    const scramble = "F U B2 R' U' B D R2 U2 L U R2 U' F2 U' L2 B2 L2 D2 F2";
    const record = { id: "real-1", scramble, moves, method: "CFOP" } as unknown as SolveRecord;
    record.cfop = computeStageBoundaries(cfopStageDetector, moves, startStateOf(scramble));
    const cases = solveCases(record, "CFOP");
    expect(cases["f2l-2"]).toMatchObject({ kind: "f2l", name: "F2L 4", after: 4 });
    expect(cases["f2l-2"]?.done).toMatchObject({ setup: 4 });
    expect(cases.oll).toMatchObject({ name: "OLL 20" });
    expect(cases.oll?.done).not.toBeNull();
  });
});
