/**
 * "Show turn arrows" — the next move of the scramble / algorithm drawn on
 * the 3D cube (and the way back after a slip). One switch for the whole
 * app, remembered in this browser.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "nact_turn_arrows";
const EVENT = "nact-turn-arrows";

const read = () => {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
};

export function useTurnArrows(): { arrows: boolean; toggleArrows: () => void } {
  const [arrows, setArrows] = useState(read);
  useEffect(() => {
    const sync = () => setArrows(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const toggleArrows = useCallback(() => {
    try {
      localStorage.setItem(KEY, String(!read()));
    } catch {
      // not persisted
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { arrows, toggleArrows };
}
