/**
 * React Context + Provider for the unified session reducer.
 * Used identically by SolvePage, TrainingPage, AttackPage (and Academy,
 * VariantTest) — only `config` (specifically `config.mode`) differs per
 * consumer.
 */

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { sessionReducer } from "./sessionReducer";
import { actions } from "./sessionActions";
import { useSmartCube } from "../hooks/useSmartCube";
import { INITIAL_SESSION_STATE } from "../types/session";
import type { SessionConfig, SessionState, StartMethod, StopMethod } from "../types/session";
import type { Orientation } from "../types/cube";

export interface SessionContextValue {
  state: SessionState;
  /**
   * Timestamp is required here (unlike the signal* methods below) because
   * hardware hooks (useSmartCube) already capture a precise timestamp at the
   * moment the move happened — recomputing performance.now() when the event
   * reaches this callback would add a few ms of jitter from React's event
   * queue.
   */
  submitCubeMove: (move: string, timestamp: number) => void;
  signalStart: (source: StartMethod) => void;
  /**
   * Optional timestamp for stop sources that know the precise moment the
   * stop condition occurred (stage-solved detection fires from an effect
   * AFTER the triggering move — the move's own hardware timestamp is the
   * honest end time, not performance.now() at dispatch).
   */
  signalStop: (source: StopMethod, timestamp?: number) => void;
  signalSolved: () => void;
  startInspection: () => void;
  /** initialOrientation: see sessionActions.targetReady — carries a hardware-frame shift into this target, so a solver who doesn't regrip between back-to-back algorithms is still recognized correctly. */
  setTarget: (targetNotation: string, initialOrientation?: Orientation) => void;
  /** Solve mode, "setup" phase only: declare scrambling done regardless of exact-match — see ActionType.MANUAL_SETUP_DONE. */
  confirmManualSetup: () => void;
  configure: (config: SessionConfig) => void;
  reset: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  config,
  children,
}: {
  config: SessionConfig;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(sessionReducer, {
    ...INITIAL_SESSION_STATE,
    config,
  });

  // A disconnect mid-attempt means no more moves can ever arrive — an
  // "active"/"ready" phase would just sit there forever with a running
  // timer and no way to finish it honestly. Abort back to idle, uniformly,
  // whatever page/mode this session belongs to (every SessionProvider
  // consumer gets this for free). Only the CUBE matters here, not an
  // optional separately-connected BT timer.
  const { connected } = useSmartCube();
  const wasConnectedRef = useRef(connected);
  useEffect(() => {
    if (wasConnectedRef.current && !connected) {
      dispatch(actions.reset());
    }
    wasConnectedRef.current = connected;
  }, [connected]);

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      submitCubeMove: (move, timestamp) => dispatch(actions.cubeMove(move, timestamp)),
      signalStart: (source) => dispatch(actions.startSignal(source, performance.now())),
      signalStop: (source, timestamp) => dispatch(actions.stopSignal(source, timestamp ?? performance.now())),
      signalSolved: () => dispatch(actions.cubeSolved(performance.now())),
      startInspection: () => dispatch(actions.inspectionStart(performance.now())),
      setTarget: (targetNotation, initialOrientation) => dispatch(actions.targetReady(targetNotation, initialOrientation)),
      confirmManualSetup: () => dispatch(actions.manualSetupDone()),
      configure: (nextConfig) => dispatch(actions.configure(nextConfig)),
      reset: () => dispatch(actions.reset()),
    }),
    [state]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
