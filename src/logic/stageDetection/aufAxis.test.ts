/**
 * Cross/F2L/OLL/PLL/AUF are all face-agnostic (see cfopStages.ts) — a solver
 * can build their cross on any of the 6 faces, so AUF's final turn(s) can
 * legitimately be a non-U/D face like L or R, not just the conventional
 * "top layer" turn. This file specifically stress-tests that the AUF stage
 * genuinely only ever touches the correct last-layer axis, across many
 * random axes (via random scrambles, whose "last completed axis" is
 * effectively uniformly distributed across all 6 faces) — a regression
 * guard for the (plausible-looking but so far unreproduced) concern that
 * AUF could get attributed to the wrong face.
 */
import { describe, it, expect } from "bun:test";
import { randomScrambleForEvent } from "cubing/scramble";
import { createSolvedState, applyMoveToState } from "./liveCubeState";
import { cfopStageDetector } from "./cfopStages";
import { computeStageBoundaries } from "./methodTracker";
import { invertSequence } from "../moveParser";

describe("AUF axis correctness across many random solves", () => {
  it("the auf stage's move(s) never disturb F2L/OLL of the already-completed pll face", async () => {
    let checkedNonTrivialAuf = 0;
    for (let trial = 0; trial < 60; trial++) {
      const scramble = (await randomScrambleForEvent("333")).toString().trim().split(/\s+/);
      const solution = invertSequence(scramble);
      const scrambled = scramble.reduce((s, m) => applyMoveToState(s, m), await createSolvedState());
      const moves = solution.map((m, i) => ({ move: m, relativeMs: i * 100 }));
      const boundaries = computeStageBoundaries(cfopStageDetector, moves, scrambled);

      const pllB = boundaries.find((b) => b.stage === "pll");
      const aufB = boundaries.find((b) => b.stage === "auf");
      if (!pllB || !aufB) continue; // didn't reach that far this trial
      if (aufB.moveIndex <= pllB.moveIndex) continue; // 0-move AUF, nothing to check

      checkedNonTrivialAuf++;
      // Replay from the pll-boundary state through each auf-stage move,
      // asserting f2l-4 and oll stay true at every intermediate step — a
      // genuine AUF turn only touches the last layer, so it must never
      // break the already-solved first two layers or last-layer orientation.
      let state = scrambled;
      for (let i = 0; i <= pllB.moveIndex; i++) state = applyMoveToState(state, moves[i].move);
      expect(cfopStageDetector.isStageSolved("f2l-4", state)).toBe(true);
      expect(cfopStageDetector.isStageSolved("oll", state)).toBe(true);

      for (let i = pllB.moveIndex + 1; i <= aufB.moveIndex; i++) {
        state = applyMoveToState(state, moves[i].move);
        expect(cfopStageDetector.isStageSolved("f2l-4", state)).toBe(true);
        expect(cfopStageDetector.isStageSolved("oll", state)).toBe(true);
      }
      expect(cfopStageDetector.isStageSolved("auf", state)).toBe(true);
    }
    // Sanity check the trial count itself — if this ever drops to 0 the test
    // below is vacuously passing and needs a closer look (e.g. invertSequence
    // or randomScrambleForEvent silently broken), not a sign AUF is fine.
    expect(checkedNonTrivialAuf).toBeGreaterThan(0);
  });
});
