/**
 * Maps a session's InputMethod choice to the SessionConfig start/stop arrays
 * the reducer actually gates on. Pure, no React/storage — the persisted
 * choice itself lives on StoredSession (see types/solve.ts), one per
 * session rather than a single global preference.
 */

import type { InputMethod, StartMethod, StopMethod } from "../types/session";

export function sessionMethodsForInput(inputMethod: InputMethod): {
  startMethod: StartMethod[];
  stopMethod: StopMethod[];
} {
  switch (inputMethod) {
    case "spacebar":
      return { startMethod: ["spacebar"], stopMethod: ["spacebar"] };
    case "timer":
      return { startMethod: ["timer-device"], stopMethod: ["timer-device"] };
    case "cube":
    default:
      return { startMethod: ["cube-move"], stopMethod: ["cube-solved"] };
  }
}
