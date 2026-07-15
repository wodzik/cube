import { describe, it, expect } from "bun:test";
import { computeStageTimings } from "./stageTiming";
import type { MoveRecord } from "../../types/session";

function move(m: string, relativeMs: number): MoveRecord {
  return { move: m, timestamp: relativeMs, relativeMs, phase: "active" };
}

describe("computeStageTimings", () => {
  it("splits each stage's window into recognition (pause before first move) and execution (first move -> completion)", () => {
    const moves = [move("R", 100), move("U", 1200), move("R'", 1300)];
    const boundaries = [
      { stage: "cross", moveIndex: 0, timestampMs: 100 },
      { stage: "f2l-1", moveIndex: 2, timestampMs: 1300 },
    ];

    const timings = computeStageTimings(["cross", "f2l-1"], boundaries, moves);

    expect(timings[0]).toMatchObject({ stage: "cross", moveCount: 1, recognitionMs: 100, executionMs: 0, totalMs: 100 });
    expect(timings[0].moves).toEqual(["R"]);

    // f2l-1 starts right after cross's move (t=100), pauses 1100ms before its
    // first move (U at t=1200), then executes for 100ms (U, R' -> t=1300).
    expect(timings[1]).toMatchObject({ stage: "f2l-1", moveCount: 2, recognitionMs: 1100, executionMs: 100, totalMs: 1200 });
    expect(timings[1].moves).toEqual(["U", "R'"]);
  });

  it("a stage completed by a run of identical moves collapses them for display AND counting (R,R -> R2 = 1 move)", () => {
    const moves = [move("R", 100), move("R", 200)];
    const boundaries = [{ stage: "cross", moveIndex: 1, timestampMs: 200 }];
    const timings = computeStageTimings(["cross"], boundaries, moves);
    // moveCount must always equal moves.length — a "cross — 2 moves: R2"
    // label contradicts itself (same rule as SolveRecord.moveCount).
    expect(timings[0].moveCount).toBe(1);
    expect(timings[0].moves).toEqual(["R2"]);
  });

  it("R,R' stays two counted moves — collapse is not algebraic cancellation", () => {
    const moves = [move("R", 100), move("R'", 200), move("U", 300)];
    const boundaries = [{ stage: "cross", moveIndex: 2, timestampMs: 300 }];
    const timings = computeStageTimings(["cross"], boundaries, moves);
    expect(timings[0].moveCount).toBe(3);
    expect(timings[0].moves).toEqual(["R", "R'", "U"]);
  });

  it("a stage already solved before the solve started (moveIndex -1) contributes zero moves/time", () => {
    const moves = [move("U", 500)];
    const boundaries = [
      { stage: "cross", moveIndex: -1, timestampMs: 0 },
      { stage: "f2l-1", moveIndex: 0, timestampMs: 500 },
    ];
    const timings = computeStageTimings(["cross", "f2l-1"], boundaries, moves);
    expect(timings[0]).toMatchObject({ moveCount: 0, recognitionMs: 0, executionMs: 0, totalMs: 0 });
    expect(timings[1]).toMatchObject({ moveCount: 1, recognitionMs: 500, executionMs: 0 });
  });

  it("a stage never reached (no boundary) gets a zeroed placeholder entry", () => {
    const timings = computeStageTimings(["cross", "f2l-1"], [{ stage: "cross", moveIndex: 0, timestampMs: 100 }], [move("R", 100)]);
    expect(timings[1]).toMatchObject({ stage: "f2l-1", moveCount: 0, moves: [], startMoveIndex: null, endMoveIndex: null });
  });
});
