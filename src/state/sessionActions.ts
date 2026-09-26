import type { SessionConfig, StartMethod, StopMethod } from "../types/session";
import type { Orientation } from "../types/cube";
import type { State } from "@cubecore/core";

export enum ActionType {
  CONFIGURE = "CONFIGURE",
  TARGET_READY = "TARGET_READY",
  TARGET_START = "TARGET_START",
  CUBE_MOVE = "CUBE_MOVE",
  START_SIGNAL = "START_SIGNAL",
  STOP_SIGNAL = "STOP_SIGNAL",
  CUBE_SOLVED = "CUBE_SOLVED",
  INSPECTION_START = "INSPECTION_START",
  MANUAL_SETUP_DONE = "MANUAL_SETUP_DONE",
  RESET = "RESET",
  ERROR = "ERROR",
}

export type SessionAction =
  | { type: ActionType.CONFIGURE; config: SessionConfig }
  // initialOrientation: carries a hardware-frame shift forward across a
  // target boundary (e.g. from one algorithm's own net M/wide/rotation
  // content into the NEXT one) — see moveParser's finalOrientationAfterAlg.
  // Undefined defaults to identity, matching all prior behavior.
  // start: the cube's state the target is followed from (default solved).
  | { type: ActionType.TARGET_READY; targetNotation: string; initialOrientation?: Orientation; start?: State }
  // The target's start moved back to before moves that are about to be replayed (see SessionProvider).
  | { type: ActionType.TARGET_START; start: State }
  | { type: ActionType.CUBE_MOVE; move: string; timestamp: number }
  | { type: ActionType.START_SIGNAL; source: StartMethod; timestamp: number }
  | { type: ActionType.STOP_SIGNAL; source: StopMethod; timestamp: number }
  | { type: ActionType.CUBE_SOLVED; timestamp: number }
  | { type: ActionType.INSPECTION_START; timestamp: number }
  | { type: ActionType.MANUAL_SETUP_DONE }
  | { type: ActionType.RESET }
  | { type: ActionType.ERROR; message: string };

export const actions = {
  configure: (config: SessionConfig): SessionAction => ({ type: ActionType.CONFIGURE, config }),
  targetReady: (targetNotation: string, initialOrientation?: Orientation, start?: State): SessionAction => ({
    type: ActionType.TARGET_READY,
    targetNotation,
    initialOrientation,
    start,
  }),
  targetStart: (start: State): SessionAction => ({ type: ActionType.TARGET_START, start }),
  cubeMove: (move: string, timestamp: number): SessionAction => ({ type: ActionType.CUBE_MOVE, move, timestamp }),
  startSignal: (source: StartMethod, timestamp: number): SessionAction => ({ type: ActionType.START_SIGNAL, source, timestamp }),
  stopSignal: (source: StopMethod, timestamp: number): SessionAction => ({ type: ActionType.STOP_SIGNAL, source, timestamp }),
  cubeSolved: (timestamp: number): SessionAction => ({ type: ActionType.CUBE_SOLVED, timestamp }),
  inspectionStart: (timestamp: number): SessionAction => ({ type: ActionType.INSPECTION_START, timestamp }),
  manualSetupDone: (): SessionAction => ({ type: ActionType.MANUAL_SETUP_DONE }),
  reset: (): SessionAction => ({ type: ActionType.RESET }),
  error: (message: string): SessionAction => ({ type: ActionType.ERROR, message }),
};
