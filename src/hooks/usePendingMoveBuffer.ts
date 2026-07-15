/**
 * Move buffer for the algorithm-drill pages (Training, Attack, VariantTest).
 *
 * THE GAP IT CLOSES: in algorithm/attack mode the reducer ignores moves
 * while phase is "done" (and "idle"), but a fast solver chains algorithms
 * back-to-back — the first moves of the NEXT algorithm arrive during the
 * done→(reset→setTarget) window (up to 1200 ms where an advance delay is
 * used, or a render frame on immediate advance) and were silently dropped,
 * desyncing the tracker from the physical cube for the whole next case.
 *
 * Usage contract:
 *  - in the page's onMove: `if (buffer.capture(move, ts)) return;` BEFORE
 *    submitCubeMove/addMove — captures moves the session would drop;
 *  - in the case-loading routine, right after reset+setTarget+cube setup:
 *    `buffer.flush((m, t) => { submitCubeMove(m, t); cubeRef.addMove(m); })`
 *    — replays them, in order, WITH THEIR ORIGINAL TIMESTAMPS (so the next
 *    attempt's timer starts at the real first move, not at flush time);
 *  - on MANUAL navigation (group switch, jump to another case): `clear()` —
 *    moves buffered toward the auto-advanced case don't belong to a case
 *    the user explicitly navigated to.
 */

import { useRef } from "react";
import type { Phase } from "../types/session";

export interface PendingMoveBuffer {
  /** Returns true when the move was captured (session would drop it) — caller must then NOT submit it. */
  capture: (move: string, timestamp: number) => boolean;
  /**
   * Replay captured moves in order. `deliver` returns whether to CONTINUE —
   * return false once the just-delivered move completed the target, and the
   * remainder stays buffered for the NEXT round's flush (a very fast solver
   * can fit more than one whole execution into the advance gap; delivering
   * past the completion would drop those moves all over again, since the
   * reducer is back in "done" by then).
   */
  flush: (deliver: (move: string, timestamp: number) => boolean) => void;
  clear: () => void;
}

export function usePendingMoveBuffer(phase: Phase): PendingMoveBuffer {
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const pendingRef = useRef<Array<{ move: string; timestamp: number }>>([]);
  // Stable identity so pages can list it in effect deps / callbacks freely.
  const apiRef = useRef<PendingMoveBuffer | null>(null);
  if (!apiRef.current) {
    apiRef.current = {
      capture: (move, timestamp) => {
        if (phaseRef.current !== "done" && phaseRef.current !== "idle") return false;
        pendingRef.current.push({ move, timestamp });
        return true;
      },
      flush: (deliver) => {
        const pending = pendingRef.current;
        pendingRef.current = [];
        for (let i = 0; i < pending.length; i++) {
          if (!deliver(pending[i].move, pending[i].timestamp)) {
            // Retain the undelivered tail — note capture() may have appended
            // NEW moves to pendingRef during delivery (it's a fresh array).
            pendingRef.current = [...pending.slice(i + 1), ...pendingRef.current];
            return;
          }
        }
      },
      clear: () => {
        pendingRef.current = [];
      },
    };
  }
  return apiRef.current;
}
