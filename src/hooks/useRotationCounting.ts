/**
 * Counting cube rotations (x, y, z) in solves from the gyroscope
 * (services/gyroOrientation, logic/solveRotations). App-wide on / off
 * (Settings → Smart cube), and a cube can have its own (My cubes).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { listCubes, onCubesChange } from "../services/cubeRegistry";
import { useSmartCubeConnection } from "./useSmartCube";

const KEY = "nact_rotations";
const EVENT = "nact-rotations";

const readApp = () => {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
};

export interface RotationCounting {
  /** Count them now: on (the connected cube's setting, else the app's) and the cube has a gyroscope. */
  active: boolean;
  /** The setting in force, whatever the cube. */
  on: boolean;
  appOn: boolean;
  setAppOn: (on: boolean) => void;
}

export function useRotationCounting(): RotationCounting {
  const conn = useSmartCubeConnection();
  const cubeId = conn?.cubeId ?? null;
  const session = conn?.session ?? null;
  const [appOn, setApp] = useState(readApp);
  const [cubesVersion, setCubesVersion] = useState(0);
  useEffect(() => {
    const sync = () => setApp(readApp());
    window.addEventListener(EVENT, sync);
    const off = onCubesChange(() => setCubesVersion((n) => n + 1));
    return () => {
      window.removeEventListener(EVENT, sync);
      off();
    };
  }, []);
  const cubeOn = useMemo(
    () => (cubeId ? (listCubes().find((c) => c.id === cubeId)?.rotations ?? null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cubeId, cubesVersion]
  );
  const setAppOn = useCallback((on: boolean) => {
    try {
      localStorage.setItem(KEY, String(on));
    } catch {
      // not kept
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const on = cubeOn ?? appOn;
  return { active: on && !!session?.info.capabilities.gyroscope, on, appOn, setAppOn };
}
