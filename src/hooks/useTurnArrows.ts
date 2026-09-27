/**
 * Turn arrows — the next move of the scramble / algorithm drawn on the 3D
 * cube (and the way back after a slip): on / off (by the cube, CubeTools)
 * and their shape (Settings): ribbons along the faces, or round arcs. One
 * setting for the whole app, remembered in this browser.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "nact_turn_arrows";
const SHAPE_KEY = "nact_turn_arrows_shape";
const EVENT = "nact-turn-arrows";

export type ArrowShape = "box" | "circle";

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not persisted
  }
  window.dispatchEvent(new Event(EVENT));
};
/** Round arcs unless "along the edges" was chosen. */
const readShape = (): ArrowShape => (read(SHAPE_KEY) === "box" ? "box" : "circle");

export function useTurnArrows(): { arrows: boolean; toggleArrows: () => void; shape: ArrowShape; setShape: (s: ArrowShape) => void } {
  const [arrows, setArrows] = useState(() => read(KEY) === "true");
  const [shape, setShapeState] = useState(readShape);
  useEffect(() => {
    const sync = () => {
      setArrows(read(KEY) === "true");
      setShapeState(readShape());
    };
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const toggleArrows = useCallback(() => write(KEY, String(read(KEY) !== "true")), []);
  const setShape = useCallback((s: ArrowShape) => write(SHAPE_KEY, s), []);
  return { arrows, toggleArrows, shape, setShape };
}
