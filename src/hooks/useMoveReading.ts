/**
 * Which slices and wide moves a solve's moves are read as, from face turns
 * and the gyro (cubecore heldTokens `wide` / `slices`) — the rest stay face
 * turns and a rotation. Settings → Smart cube; applies to every solve shown,
 * recorded before or after.
 */

import { useEffect, useState } from "react";
import { DEFAULT_SLICES, DEFAULT_WIDE, type HeldOptions } from "@wodzik/cubecore/bluetooth";

const KEY = "nact_move_reading";
const EVENT = "nact-move-reading";

export const WIDE_MOVES = ["r", "l", "f", "b", "u", "d"] as const;
export const SLICE_MOVES = ["M", "E", "S"] as const;

export function readMoveReading(): Required<HeldOptions> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<HeldOptions> | null;
    return { wide: v?.wide ?? DEFAULT_WIDE, slices: v?.slices ?? DEFAULT_SLICES };
  } catch {
    return { wide: DEFAULT_WIDE, slices: DEFAULT_SLICES };
  }
}

export function setMoveReading(next: Required<HeldOptions>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // not kept
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useMoveReading(): Required<HeldOptions> {
  const [reading, setReading] = useState(readMoveReading);
  useEffect(() => {
    const sync = () => setReading(readMoveReading());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return reading;
}
