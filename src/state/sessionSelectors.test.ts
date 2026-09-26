import { describe, it, expect } from "bun:test";
import { applyMoves, solvedState } from "@cubecore/core";
import { selectCurrentProgress, selectTracking } from "./sessionSelectors";
import { INITIAL_SESSION_STATE } from "../types/session";
import type { SessionState } from "../types/session";
import { sequenceTarget } from "../logic/cubecoreSequence";

const log = (moves: string) =>
  moves.split(" ").filter(Boolean).map((move, i) => ({ move, timestamp: i, relativeMs: 0, phase: "setup" as const }));

describe("selectCurrentProgress", () => {
  it("returns null for an empty target (manual starting stage) instead of a trivially-completed progress", () => {
    const state: SessionState = { ...INITIAL_SESSION_STATE, phase: "setup", targetNotation: "", target: sequenceTarget() };
    expect(selectCurrentProgress(state)).toBeNull();
    expect(selectTracking(state)).toBeNull();
  });

  it("still tracks progress normally for a non-empty target", () => {
    const state: SessionState = { ...INITIAL_SESSION_STATE, phase: "setup", targetNotation: "R U", target: sequenceTarget() };
    const progress = selectCurrentProgress(state);
    expect(progress).not.toBeNull();
    expect(progress?.complete).toBe(false);
    expect(selectTracking(state)?.notation).toBe("R U");
  });

  it("follows the target from the cube's state when it was set (not from solved)", () => {
    const start = applyMoves(solvedState(), "F2 D' L");
    const state: SessionState = { ...INITIAL_SESSION_STATE, phase: "setup", targetNotation: "R U2", target: sequenceTarget(start), moveLog: log("R U U") };
    expect(selectCurrentProgress(state)?.complete).toBe(true);
  });

  it("remembers a slip even once it's undone", () => {
    const state: SessionState = { ...INITIAL_SESSION_STATE, phase: "setup", targetNotation: "R U", target: sequenceTarget(), moveLog: log("R F F' U") };
    const p = selectCurrentProgress(state);
    expect(p?.complete).toBe(true);
    expect(p?.hadErrors).toBe(true);
  });

  it("the bar keeps following through the phase right after the target is done", () => {
    const base = { ...INITIAL_SESSION_STATE, targetNotation: "R U", target: sequenceTarget(), moveLog: log("R U") };
    expect(selectTracking({ ...base, phase: "ready" })?.moves).toHaveLength(2);
    expect(selectTracking({ ...base, phase: "active" })).toBeNull(); // solve: the log is the solve now
    const alg = { ...base, config: { ...base.config, mode: "algorithm" as const } };
    expect(selectTracking({ ...alg, phase: "done" })?.moves).toHaveLength(2);
  });
});
