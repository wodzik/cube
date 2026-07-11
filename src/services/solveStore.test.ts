import { describe, it, expect, beforeEach } from "bun:test";
import "../testSetup";
import { getSolves, saveSolve, deleteSolve, patchSolve, getSolvesForSession, ensureDefaultSession, getSessions } from "./solveStore";
import type { SolveRecord } from "../types/solve";

function makeSolve(overrides: Partial<SolveRecord> = {}): SolveRecord {
  return {
    id: crypto.randomUUID(),
    sessionId: "s1",
    method: "CFOP",
    startMethod: "cube-move",
    stopMethod: "cube-solved",
    timerStartedAt: 0,
    firstMoveAt: 10,
    timeToFirstMoveMs: 10,
    endedAt: 1000,
    timeMs: 1000,
    scramble: "R U R' U'",
    scrambleMoves: ["R", "U", "R'", "U'"],
    moves: [],
    reducedMoves: [],
    moveCount: 0,
    tps: 0,
    cfop: [],
    roux: [],
    lbl: [],
    isDNF: false,
    ...overrides,
  };
}

describe("solveStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and retrieves solves", () => {
    const solve = makeSolve();
    saveSolve(solve);
    expect(getSolves()).toHaveLength(1);
    expect(getSolves()[0].id).toBe(solve.id);
  });

  it("filters solves by session", () => {
    saveSolve(makeSolve({ sessionId: "a" }));
    saveSolve(makeSolve({ sessionId: "b" }));
    expect(getSolvesForSession("a")).toHaveLength(1);
    expect(getSolvesForSession("b")).toHaveLength(1);
  });

  it("patchSolve merges fields into an existing solve — the self-heal path for legacy records missing newer boundary lists", () => {
    const solve = makeSolve();
    saveSolve(solve);
    // Simulate a record written before `lbl` existed.
    const stored = JSON.parse(localStorage.getItem("nact_solves")!);
    delete stored[0].lbl;
    localStorage.setItem("nact_solves", JSON.stringify(stored));

    patchSolve(solve.id, { lbl: [{ stage: "cross", moveIndex: 3, timestampMs: 100 }] });
    const healed = getSolves()[0];
    expect(healed.lbl).toHaveLength(1);
    expect(healed.timeMs).toBe(solve.timeMs); // untouched fields preserved
  });

  it("deletes a solve by id", () => {
    const solve = makeSolve();
    saveSolve(solve);
    deleteSolve(solve.id);
    expect(getSolves()).toHaveLength(0);
  });

  it("ensureDefaultSession creates one session and reuses it", () => {
    const id1 = ensureDefaultSession();
    const id2 = ensureDefaultSession();
    expect(id1).toBe(id2);
    expect(getSessions()).toHaveLength(1);
  });

  it("getSessions backfills inputMethod/startingStage/solveMethod on sessions written by an older build", () => {
    // Simulates a session saved before StoredSession grew these fields —
    // written directly to bypass saveSession's current (already-typed) shape.
    localStorage.setItem(
      "nact_sessions",
      JSON.stringify([{ id: "legacy-1", name: "Main", inspectionMode: "wca" }])
    );

    const sessions = getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].inputMethod).toBe("cube");
    expect(sessions[0].startingStage).toBe("scratch"); // must default to scratch, not stay undefined — see normalizeSession's doc comment
    expect(sessions[0].solveMethod).toBe("CFOP"); // same reasoning — must default, not stay undefined
    expect(sessions[0].customInspectionSeconds).toBe(15); // and the custom-inspection default

    // Self-healed: a second read (or a raw localStorage export) sees the
    // backfilled fields too, not just the in-memory return value.
    const raw = JSON.parse(localStorage.getItem("nact_sessions")!);
    expect(raw[0].startingStage).toBe("scratch");
    expect(raw[0].solveMethod).toBe("CFOP");
  });
});
