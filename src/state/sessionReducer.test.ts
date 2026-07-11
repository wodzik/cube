import { describe, it, expect } from "bun:test";
import { sessionReducer } from "./sessionReducer";
import { actions } from "./sessionActions";
import { INITIAL_SESSION_STATE } from "../types/session";
import type { SessionConfig, SessionState } from "../types/session";

function configured(config: Partial<SessionConfig>): SessionState {
  const fullConfig: SessionConfig = {
    mode: "solve",
    startMethod: ["cube-move"],
    stopMethod: ["cube-solved"],
    useInspection: false,
    inspectionSeconds: 15,
    ...config,
  };
  return sessionReducer(INITIAL_SESSION_STATE, actions.configure(fullConfig));
}

describe("sessionReducer — solve mode, cube-move start/stop", () => {
  it("runs the full lifecycle: idle -> setup -> ready -> active -> done", () => {
    let state = configured({ mode: "solve", startMethod: ["cube-move"], stopMethod: ["cube-solved"] });
    expect(state.phase).toBe("idle");

    state = sessionReducer(state, actions.targetReady("R U"));
    expect(state.phase).toBe("setup");
    expect(state.targetNotation).toBe("R U");
    expect(state.moveLog).toEqual([]);

    state = sessionReducer(state, actions.cubeMove("R", 1000));
    expect(state.phase).toBe("setup"); // scramble not finished yet
    state = sessionReducer(state, actions.cubeMove("U", 1100));
    expect(state.phase).toBe("ready"); // scramble matched

    // First solve move (cube-move start method) starts the timer.
    state = sessionReducer(state, actions.cubeMove("F", 2000));
    expect(state.phase).toBe("active");
    expect(state.startTime).toBe(2000);
    expect(state.moveLog).toHaveLength(1);
    expect(state.moveLog[0]).toMatchObject({ move: "F", relativeMs: 0, phase: "active" });

    state = sessionReducer(state, actions.cubeMove("R", 2500));
    expect(state.moveLog).toHaveLength(2);
    expect(state.moveLog[1].relativeMs).toBe(500);

    state = sessionReducer(state, actions.cubeSolved(3000));
    expect(state.phase).toBe("done");
    expect(state.endTime).toBe(3000);
  });

  it("does not advance out of setup on a wrong scramble move", () => {
    let state = configured({ mode: "solve" });
    state = sessionReducer(state, actions.targetReady("R U"));
    state = sessionReducer(state, actions.cubeMove("F", 1000));
    expect(state.phase).toBe("setup");
    expect(state.moveLog).toHaveLength(1);
  });

  it("ignores moves in idle and done phases", () => {
    let state = configured({ mode: "solve" });
    state = sessionReducer(state, actions.cubeMove("R", 1000));
    expect(state.phase).toBe("idle");
    expect(state.moveLog).toEqual([]);
  });
});

describe("sessionReducer — solve mode, spacebar start/stop", () => {
  it("ignores cube moves before START_SIGNAL, and moves logged once active come from timer start", () => {
    let state = configured({ mode: "solve", startMethod: ["spacebar"], stopMethod: ["spacebar"] });
    state = sessionReducer(state, actions.targetReady("R"));
    state = sessionReducer(state, actions.cubeMove("R", 1000));
    expect(state.phase).toBe("ready");

    const readyState = state;
    // Move while ready, spacebar start method — must be ignored (timer not started):
    // the reducer returns the exact same state reference, nothing changes.
    state = sessionReducer(state, actions.cubeMove("U", 1500));
    expect(state.phase).toBe("ready");
    expect(state).toBe(readyState);

    state = sessionReducer(state, actions.startSignal("spacebar", 2000));
    expect(state.phase).toBe("active");
    expect(state.startTime).toBe(2000);
    // Entering "active" via START_SIGNAL resets moveLog — the scramble's own
    // move log (from "setup") does not carry over into the solve.
    expect(state.moveLog).toEqual([]);

    state = sessionReducer(state, actions.cubeMove("F", 2200));
    expect(state.moveLog).toHaveLength(1);

    state = sessionReducer(state, actions.stopSignal("spacebar", 3000));
    expect(state.phase).toBe("done");
    expect(state.endTime).toBe(3000);
  });

  it("START_SIGNAL from the wrong source is ignored", () => {
    let state = configured({ mode: "solve", startMethod: ["spacebar"] });
    state = sessionReducer(state, actions.targetReady("R"));
    state = sessionReducer(state, actions.cubeMove("R", 1000)); // -> ready
    state = sessionReducer(state, actions.startSignal("timer-device", 2000));
    expect(state.phase).toBe("ready"); // unaffected
  });
});

describe("sessionReducer — solve mode, manual (hand) scrambling", () => {
  it("MANUAL_SETUP_DONE freezes whatever was actually performed as the new scramble and moves to ready", () => {
    let state = configured({ mode: "solve" });
    state = sessionReducer(state, actions.targetReady("R U2 R2 F")); // shown suggestion
    state = sessionReducer(state, actions.cubeMove("L", 1000)); // solver ignores it, does their own thing
    state = sessionReducer(state, actions.cubeMove("D'", 1100));
    expect(state.phase).toBe("setup"); // not a match, still setup

    state = sessionReducer(state, actions.manualSetupDone());
    expect(state.phase).toBe("ready");
    expect(state.targetNotation).toBe("L D'"); // the actual moves performed, not the abandoned suggestion
  });

  it("is a no-op outside setup phase", () => {
    let state = configured({ mode: "solve" });
    state = sessionReducer(state, actions.targetReady("R"));
    state = sessionReducer(state, actions.cubeMove("R", 1000)); // -> ready (matched)
    const readyState = state;
    state = sessionReducer(state, actions.manualSetupDone());
    expect(state).toBe(readyState); // unchanged reference — reducer returned early
  });

  it("is a no-op outside solve mode", () => {
    let state = configured({ mode: "algorithm" });
    state = sessionReducer(state, actions.targetReady("R U R' U'"));
    const setupState = state;
    state = sessionReducer(state, actions.manualSetupDone());
    expect(state).toBe(setupState);
  });

  it("allows an empty scramble (declare ready with zero moves performed)", () => {
    let state = configured({ mode: "solve" });
    state = sessionReducer(state, actions.targetReady("R U2 R2 F"));
    state = sessionReducer(state, actions.manualSetupDone());
    expect(state.phase).toBe("ready");
    expect(state.targetNotation).toBe("");
  });

  it("empty target notation (manual starting stage) never auto-completes via ordinary move matching, however many moves come in", () => {
    // computeSequenceProgress treats an empty target as trivially
    // "completed" (see logic/sequenceTracker.ts's EMPTY_PROGRESS) — without
    // the reducer's own bypass, handleTrackedMove would jump straight to
    // "ready" after the FIRST move instead of waiting for the explicit
    // MANUAL_SETUP_DONE action. This is the bug non-"scratch" starting
    // stages rely on being fixed.
    let state = configured({ mode: "solve" });
    state = sessionReducer(state, actions.targetReady("")); // manual starting stage: nothing to match
    expect(state.phase).toBe("setup");

    state = sessionReducer(state, actions.cubeMove("R", 1000));
    expect(state.phase).toBe("setup"); // must NOT have jumped to "ready" on move #1
    expect(state.moveLog).toHaveLength(1);

    state = sessionReducer(state, actions.cubeMove("U", 1100));
    state = sessionReducer(state, actions.cubeMove("F2", 1200));
    expect(state.phase).toBe("setup"); // still setup no matter how many moves accumulate
    expect(state.moveLog).toHaveLength(3);

    state = sessionReducer(state, actions.manualSetupDone());
    expect(state.phase).toBe("ready"); // only the explicit action advances it
    expect(state.targetNotation).toBe("R U F2");
  });
});

describe("sessionReducer — solve mode, multiple simultaneously-enabled start/stop methods", () => {
  it("accepts a start signal from ANY enabled method, not just the first one listed", () => {
    let state = configured({ mode: "solve", startMethod: ["cube-move", "spacebar", "timer-device"], stopMethod: ["cube-solved", "spacebar", "timer-device"] });
    state = sessionReducer(state, actions.targetReady("R"));
    state = sessionReducer(state, actions.cubeMove("R", 1000)); // scramble matched -> ready

    state = sessionReducer(state, actions.startSignal("timer-device", 2000));
    expect(state.phase).toBe("active");
    expect(state.startedBy).toBe("timer-device");
  });

  it("a physical move also starts it when cube-move is one of several enabled methods", () => {
    let state = configured({ mode: "solve", startMethod: ["cube-move", "spacebar"], stopMethod: ["cube-solved", "spacebar"] });
    state = sessionReducer(state, actions.targetReady("R"));
    state = sessionReducer(state, actions.cubeMove("R", 1000)); // scramble matched -> ready

    state = sessionReducer(state, actions.cubeMove("U", 1500));
    expect(state.phase).toBe("active");
    expect(state.startedBy).toBe("cube-move");
  });

  it("records which method actually stopped it, independent of which one started it", () => {
    let state = configured({ mode: "solve", startMethod: ["spacebar", "timer-device"], stopMethod: ["cube-solved", "spacebar", "timer-device"] });
    state = sessionReducer(state, actions.targetReady("R"));
    state = sessionReducer(state, actions.cubeMove("R", 1000)); // -> ready
    state = sessionReducer(state, actions.startSignal("spacebar", 2000));
    expect(state.startedBy).toBe("spacebar");

    state = sessionReducer(state, actions.cubeSolved(3000));
    expect(state.phase).toBe("done");
    expect(state.endedBy).toBe("cube-solved");
  });

  it("a signal from a method NOT in the enabled set is still rejected", () => {
    let state = configured({ mode: "solve", startMethod: ["spacebar"], stopMethod: ["spacebar"] });
    state = sessionReducer(state, actions.targetReady("R"));
    state = sessionReducer(state, actions.cubeMove("R", 1000)); // -> ready
    state = sessionReducer(state, actions.startSignal("timer-device", 2000));
    expect(state.phase).toBe("ready");
    expect(state.startedBy).toBeNull();
  });

  it("startedBy/endedBy reset to null on a new TARGET_READY (next scramble)", () => {
    let state = configured({ mode: "solve", startMethod: ["spacebar"], stopMethod: ["spacebar"] });
    state = sessionReducer(state, actions.targetReady("R"));
    state = sessionReducer(state, actions.cubeMove("R", 1000));
    state = sessionReducer(state, actions.startSignal("spacebar", 2000));
    state = sessionReducer(state, actions.stopSignal("spacebar", 3000));
    expect(state.startedBy).toBe("spacebar");
    expect(state.endedBy).toBe("spacebar");

    state = sessionReducer(state, actions.targetReady("U"));
    expect(state.startedBy).toBeNull();
    expect(state.endedBy).toBeNull();
  });
});

describe("sessionReducer — solve mode, inspection", () => {
  it("goes through ready -> inspecting -> active", () => {
    let state = configured({ mode: "solve", startMethod: ["spacebar"], stopMethod: ["spacebar"], useInspection: true });
    state = sessionReducer(state, actions.targetReady("R"));
    state = sessionReducer(state, actions.cubeMove("R", 1000)); // -> ready

    state = sessionReducer(state, actions.inspectionStart(1500));
    expect(state.phase).toBe("inspecting");
    expect(state.inspectionStartTime).toBe(1500);

    state = sessionReducer(state, actions.startSignal("spacebar", 3000));
    expect(state.phase).toBe("active");
    expect(state.startTime).toBe(3000);
  });
});

describe("sessionReducer — algorithm mode", () => {
  it("first move starts the timer AND is tracked against the algorithm", () => {
    let state = configured({ mode: "algorithm" });
    state = sessionReducer(state, actions.targetReady("R U R' U'"));
    expect(state.phase).toBe("setup");

    state = sessionReducer(state, actions.cubeMove("R", 1000));
    expect(state.phase).toBe("active");
    expect(state.startTime).toBe(1000);
    expect(state.moveLog).toHaveLength(1);

    state = sessionReducer(state, actions.cubeMove("U", 1200));
    state = sessionReducer(state, actions.cubeMove("R'", 1500));
    expect(state.phase).toBe("active");

    state = sessionReducer(state, actions.cubeMove("U'", 1800));
    expect(state.phase).toBe("done");
    expect(state.endTime).toBe(1800);
  });

  it("completing a single-move algorithm on the very first move goes straight to done", () => {
    let state = configured({ mode: "algorithm" });
    state = sessionReducer(state, actions.targetReady("R"));
    state = sessionReducer(state, actions.cubeMove("R", 1000));
    expect(state.phase).toBe("done");
    expect(state.startTime).toBe(1000);
    expect(state.endTime).toBe(1000);
  });

  it("START_SIGNAL/STOP_SIGNAL are no-ops in algorithm mode", () => {
    let state = configured({ mode: "algorithm" });
    state = sessionReducer(state, actions.targetReady("R"));
    const beforeStart = state;
    state = sessionReducer(state, actions.startSignal("spacebar", 999));
    expect(state).toBe(beforeStart); // unchanged reference — reducer returned early
  });
});

describe("sessionReducer — attack mode behaves like algorithm mode for the reducer's purposes", () => {
  it("tracks the target the same way; queue/case-advance logic lives in the page controller, not here", () => {
    let state = configured({ mode: "attack" });
    state = sessionReducer(state, actions.targetReady("U2"));
    state = sessionReducer(state, actions.cubeMove("U", 1000));
    expect(state.phase).toBe("active");
    state = sessionReducer(state, actions.cubeMove("U", 1200));
    expect(state.phase).toBe("done");
  });
});

describe("sessionReducer — reset", () => {
  it("returns to idle, keeping config but clearing everything else", () => {
    let state = configured({ mode: "algorithm" });
    state = sessionReducer(state, actions.targetReady("R"));
    state = sessionReducer(state, actions.cubeMove("R", 1000));
    expect(state.phase).toBe("done");

    state = sessionReducer(state, actions.reset());
    expect(state.phase).toBe("idle");
    expect(state.config.mode).toBe("algorithm");
    expect(state.moveLog).toEqual([]);
    expect(state.target).toBeNull();
  });
});
