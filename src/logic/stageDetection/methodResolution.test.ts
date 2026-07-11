import { describe, it, expect } from "bun:test";
import { randomScrambleForEvent } from "cubing/scramble";
import { createSolvedState, applyMoveToState } from "./liveCubeState";
import { cfopStageDetector } from "./cfopStages";
import { MethodResolution } from "./methodResolution";
import { METHOD_RESOLVERS } from "./methodResolvers";
import type { MethodResolver } from "./methodResolvers";
import { invertSequence } from "../moveParser";

describe("MethodResolution", () => {
  it("locks onto CFOP immediately (before any move) with today's stubbed always-confirmed registry", async () => {
    const solved = await createSolvedState();
    const resolution = new MethodResolution(METHOD_RESOLVERS, solved);
    expect(resolution.method).toBe("CFOP");
    expect(resolution.isLocked).toBe(true);
    expect(resolution.boundaries).toHaveLength(cfopStageDetector.stages.length); // solved start -> every stage already satisfied
  });

  it("continues tracking the locked method's boundaries as moves come in, starting from nothing solved yet", async () => {
    const scramble = (await randomScrambleForEvent("333")).toString().trim().split(/\s+/);
    const solution = invertSequence(scramble);
    const scrambled = scramble.reduce((s, m) => applyMoveToState(s, m), await createSolvedState());

    const resolution = new MethodResolution(METHOD_RESOLVERS, scrambled);
    expect(resolution.isLocked).toBe(true); // CFOP still confirms immediately (stub), independent of the starting state
    expect(resolution.boundaries).toHaveLength(0); // a real scramble breaks cross on every face — nothing pre-satisfied

    solution.forEach((move, i) => resolution.feedMove({ move, relativeMs: i * 100 }, i));
    // Boundaries accumulate move by move (append-only, never un-recorded)
    // until the solve genuinely finishes.
    expect(resolution.boundaries.map((b) => b.stage)).toEqual([...cfopStageDetector.stages]);
  });

  it("once locked, a resolver that only just became confirmed is never switched to — first-confirmed wins and stays", async () => {
    const solved = await createSolvedState();
    let secondCheckCount = 0;
    const alwaysSecond: MethodResolver = {
      detector: { ...cfopStageDetector, method: "AlwaysSecond" },
      isConfirmed: () => {
        secondCheckCount++;
        return true;
      },
    };
    // cfopResolver (from METHOD_RESOLVERS) is first in priority order and
    // also stubbed to confirm immediately, so it locks at construction —
    // alwaysSecond should never even get a chance to run.
    const resolution = new MethodResolution([...METHOD_RESOLVERS, alwaysSecond], solved);
    expect(resolution.method).toBe("CFOP");
    expect(secondCheckCount).toBe(0);
  });

  it("before anything confirms, falls back to the first registered resolver's method as a tentative default", async () => {
    const solved = await createSolvedState();
    const neverConfirms: MethodResolver = {
      detector: { ...cfopStageDetector, method: "NeverConfirms", stages: cfopStageDetector.stages },
      isConfirmed: () => false,
    };
    const resolution = new MethodResolution([neverConfirms], solved);
    expect(resolution.isLocked).toBe(false);
    expect(resolution.method).toBe("NeverConfirms"); // only candidate, shown tentatively
  });
});
