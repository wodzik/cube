/**
 * Turn arrows — the next move of the scramble / algorithm drawn on the 3D
 * cube (and the way back after a slip). One mode: off, round arcs, or
 * ribbons along the edges. The app's mode (Settings, remembered in this
 * browser) — or the connected cube's own (Settings → My cubes), which wins
 * while it's connected. The switch by the cube (CubeTools) turns whichever
 * is in force on / off.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSmartCubeConnection } from "./useSmartCube";
import { listCubes, onCubesChange, updateCube } from "../services/cubeRegistry";

const KEY = "nact_turn_arrows";
const SHAPE_KEY = "nact_turn_arrows_shape";
const EVENT = "nact-turn-arrows";

export type ArrowShape = "box" | "circle";
export type ArrowMode = "off" | ArrowShape;

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (entries: [string, string][]) => {
  try {
    for (const [k, v] of entries) localStorage.setItem(k, v);
  } catch {
    // not persisted
  }
  window.dispatchEvent(new Event(EVENT));
};
/** Round arcs unless "along the edges" was chosen. */
const readShape = (): ArrowShape => (read(SHAPE_KEY) === "box" ? "box" : "circle");
const readAppMode = (): ArrowMode => (read(KEY) === "true" ? readShape() : "off");

export interface TurnArrows {
  /** Arrows shown (in force: the cube's mode or the app's). */
  arrows: boolean;
  shape: ArrowShape;
  /** The app's mode (Settings). */
  appMode: ArrowMode;
  setAppMode: (m: ArrowMode) => void;
  /** The connected cube's own mode, if it has one. */
  cubeMode: ArrowMode | null;
  /** On / off for whichever mode is in force. */
  toggleArrows: () => void;
}

export function useTurnArrows(): TurnArrows {
  const [appMode, setAppModeState] = useState(readAppMode);
  const cubeId = useSmartCubeConnection()?.cubeId ?? null;
  const [cubesVersion, setCubesVersion] = useState(0);
  useEffect(() => {
    const sync = () => setAppModeState(readAppMode());
    window.addEventListener(EVENT, sync);
    const off = onCubesChange(() => setCubesVersion((n) => n + 1));
    return () => {
      window.removeEventListener(EVENT, sync);
      off();
    };
  }, []);
  const cubeMode = useMemo(
    () => (cubeId ? (listCubes().find((c) => c.id === cubeId)?.arrows ?? null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cubeId, cubesVersion]
  );

  const setAppMode = useCallback((m: ArrowMode) => {
    write(m === "off" ? [[KEY, "false"]] : [[KEY, "true"], [SHAPE_KEY, m]]);
  }, []);

  const mode = cubeMode ?? appMode;
  const toggleArrows = useCallback(() => {
    const on: ArrowShape = mode === "off" ? readShape() : mode;
    if (cubeMode && cubeId) updateCube(cubeId, { arrows: mode === "off" ? on : "off" });
    else setAppMode(mode === "off" ? on : "off");
  }, [mode, cubeMode, cubeId, setAppMode]);

  return { arrows: mode !== "off", shape: mode === "off" ? readShape() : mode, appMode, setAppMode, cubeMode, toggleArrows };
}
