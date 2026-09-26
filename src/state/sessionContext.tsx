/**
 * React Context + Provider for the unified session reducer.
 * Used identically by SolvePage, TrainingPage, AttackPage (and Academy,
 * VariantTest) — only `config` (specifically `config.mode`) differs per
 * consumer.
 */

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { sessionReducer } from "./sessionReducer";
import { actions } from "./sessionActions";
import { useSmartCube, useSmartCubeConnection } from "../hooks/useSmartCube";
import { type SequenceTarget, type TrackedProgress, sequenceProgress, sequenceTarget } from "../logic/cubecoreSequence";
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
  /**
   * Progress of the target just set after `moves` — for replaying buffered
   * moves right after setTarget (the reducer's state isn't updated yet):
   * stop once one completes it. Same start as the session uses.
   */
  targetProgress: (moves: readonly string[]) => TrackedProgress | null;
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
  const cube = useSmartCubeConnection();
  const cubeRef = useRef(cube);
  cubeRef.current = cube;

  // The target as the reducer will have it, kept here synchronously: set
  // from the cube's state NOW (it lives in the app-wide SmartCubeSession, so
  // it's right whatever happened on other pages), and moved back once if the
  // first move fed to it is a replayed one made before it was set.
  const targetRef = useRef<{ notation: string; target: SequenceTarget; setAt: number; fed: boolean } | null>(null);
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
      submitCubeMove: (move, timestamp) => {
        const t = targetRef.current;
        if (t && !t.fed) {
          t.fed = true;
          const before = timestamp < t.setAt ? cubeRef.current?.stateBefore(timestamp) : null;
          if (before) {
            t.target = { ...t.target, start: before };
            dispatch(actions.targetStart(before));
          }
        }
        dispatch(actions.cubeMove(move, timestamp));
      },
      signalStart: (source) => dispatch(actions.startSignal(source, performance.now())),
      signalStop: (source, timestamp) => dispatch(actions.stopSignal(source, timestamp ?? performance.now())),
      signalSolved: () => dispatch(actions.cubeSolved(performance.now())),
      startInspection: () => dispatch(actions.inspectionStart(performance.now())),
      setTarget: (targetNotation, initialOrientation) => {
        const start = cubeRef.current?.session?.state ?? null;
        targetRef.current = { notation: targetNotation, target: sequenceTarget(start, initialOrientation), setAt: performance.now(), fed: false };
        dispatch(actions.targetReady(targetNotation, initialOrientation, start ?? undefined));
      },
      targetProgress: (moves) => {
        const t = targetRef.current;
        return t ? sequenceProgress(t.notation, t.target, moves) : null;
      },
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
