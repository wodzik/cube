/**
 * React Context + Provider for the unified session reducer.
 * Used identically by SolvePage, TrainingPage, AttackPage — only `config`
 * (specifically `config.mode`) differs per page.
 */

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { sessionReducer } from "./sessionReducer";
import { actions } from "./sessionActions";
import { INITIAL_SESSION_STATE } from "../types/session";
import type { SessionConfig, SessionState, StartMethod, StopMethod } from "../types/session";

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
  signalStop: (source: StopMethod) => void;
  signalSolved: () => void;
  startInspection: () => void;
  setTarget: (targetNotation: string) => void;
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

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      submitCubeMove: (move, timestamp) => dispatch(actions.cubeMove(move, timestamp)),
      signalStart: (source) => dispatch(actions.startSignal(source, performance.now())),
      signalStop: (source) => dispatch(actions.stopSignal(source, performance.now())),
      signalSolved: () => dispatch(actions.cubeSolved(performance.now())),
      startInspection: () => dispatch(actions.inspectionStart(performance.now())),
      setTarget: (targetNotation) => dispatch(actions.targetReady(targetNotation)),
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
