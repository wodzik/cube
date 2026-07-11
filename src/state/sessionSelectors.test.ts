import { describe, it, expect } from "bun:test";
import { selectCurrentProgress } from "./sessionSelectors";
import { INITIAL_SESSION_STATE } from "../types/session";
import type { SessionState } from "../types/session";
import { buildSequenceTarget } from "../logic/sequenceTracker";

describe("selectCurrentProgress", () => {
  it("returns null for an empty target (manual starting stage) instead of a trivially-completed progress", () => {
    const state: SessionState = {
      ...INITIAL_SESSION_STATE,
      phase: "setup",
      targetNotation: "",
      target: buildSequenceTarget(""),
    };
    expect(selectCurrentProgress(state)).toBeNull();
  });

  it("still tracks progress normally for a non-empty target", () => {
    const state: SessionState = {
      ...INITIAL_SESSION_STATE,
      phase: "setup",
      targetNotation: "R U",
      target: buildSequenceTarget("R U"),
    };
    const progress = selectCurrentProgress(state);
    expect(progress).not.toBeNull();
    expect(progress?.isCompleted).toBe(false);
  });
});
