import { beforeEach, describe, expect, it } from "bun:test";
import "../testSetup";
import { formatMove, toFaceTurns } from "@wodzik/cubecore/core";
import { getSolves, saveSolve } from "./solveStore";
import { healStageBoundaries } from "./stageHeal";
import { STAGES_VERSION } from "../logic/stageDetection/lastLayerShared";
import type { SolveRecord } from "../types/solve";

const base = (overrides: Partial<SolveRecord>): SolveRecord => ({
  id: crypto.randomUUID(),
  sessionId: "s1",
  method: "CFOP",
  startMethod: "cube-move",
  stopMethod: "cube-solved",
  timerStartedAt: 0,
  firstMoveAt: 0,
  timeToFirstMoveMs: 0,
  endedAt: 1000,
  timeMs: 1000,
  scramble: "",
  scrambleMoves: [],
  moves: [],
  reducedMoves: [],
  moveCount: 0,
  tps: 0,
  cfop: [],
  roux: [],
  lbl: [],
  isDNF: false,
  ...overrides,
});

describe("stored solves healed to the current stage detection", () => {
  beforeEach(() => localStorage.clear());

  it("a red-cross solve (version 1 saw its OLL only at the end) gets its OLL; a white-cross one is just stamped", async () => {
    // The red-cross solve from a bug report (moves as the cube reported them).
    const held =
      "x' y' F' l' F B' L' D' B y' D' x' y' R R' y F2 D' z F2 L L' F L2 F2 L' L F F' L' F L F' L' F' R F R' F' D F D' z F D F2 D' z F L F' L' F' L' F L F' L' F L F D F' D' F' D F' D' F D F' D' z' F2 D U' B R B' D' U F' l' F R F' x' F B R' F' R B' F R2 F R' F R F' R F' l' R' U";
    const moves = toFaceTurns(held).moves.map((m, i) => ({ move: formatMove(m), relativeMs: i * 100, timestamp: i * 100, phase: "active" as const }));
    const stale = base({
      scramble: "B L' F' L2 B L' U D F U2 L2 U' R2 L2 U' B2 U' B2 D' B2 U'",
      moves,
      cfop: [{ stage: "cross", moveIndex: 7, timestampMs: 700, detail: "R" }, { stage: "oll", moveIndex: 93, timestampMs: 9300 }],
    });
    const white = base({ cfop: [{ stage: "cross", moveIndex: 3, timestampMs: 300, detail: "D" }] });
    saveSolve(stale);
    saveSolve(white);
    expect(await healStageBoundaries()).toBe(1);
    const [a, b] = getSolves();
    expect(a.cfop.find((x) => x.stage === "oll")?.moveIndex).toBe(75);
    expect(a.cfop.find((x) => x.stage === "pll")?.moveIndex).toBe(92);
    expect(a.stagesVersion).toBe(STAGES_VERSION);
    expect(b.cfop).toEqual(white.cfop);
    expect(b.stagesVersion).toBe(STAGES_VERSION);
    expect(await healStageBoundaries()).toBe(0);
  });
});
