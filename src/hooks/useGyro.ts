/**
 * The gyroscope — the 3D cube turns as you hold the smart cube (cubes that
 * have one: most GAN, MoYu AI…). App-wide on / off (Settings), and a cube can
 * have its own (My cubes). "Reset gyro" = the cube as held now is the cube as
 * shown (SmartCubeSession.calibrate).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { listCubes, onCubesChange, updateCube } from "../services/cubeRegistry";
import { useSmartCubeConnection } from "./useSmartCube";

const KEY = "nact_gyro";
const EVENT = "nact-gyro";

const readApp = () => {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
};

export interface Gyro {
  /** Follow the gyro now (the connected cube's setting, else the app's). */
  gyro: boolean;
  /** The connected cube has a gyroscope. */
  supported: boolean;
  appGyro: boolean;
  setAppGyro: (on: boolean) => void;
  /** The connected cube's own setting, if it has one. */
  cubeGyro: boolean | null;
  /** On / off for whichever setting is in force. */
  toggleGyro: () => void;
  /** "Held as shown": the cube as held now is the cube as drawn. */
  resetGyro: () => void;
}

export function useGyro(): Gyro {
  const conn = useSmartCubeConnection();
  const cubeId = conn?.cubeId ?? null;
  const session = conn?.session ?? null;
  const [appGyro, setApp] = useState(readApp);
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
  const cubeGyro = useMemo(
    () => (cubeId ? (listCubes().find((c) => c.id === cubeId)?.gyro ?? null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cubeId, cubesVersion]
  );
  const setAppGyro = useCallback((on: boolean) => {
    try {
      localStorage.setItem(KEY, String(on));
    } catch {
      // not kept
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const gyro = cubeGyro ?? appGyro;
  const toggleGyro = useCallback(() => {
    if (cubeGyro !== null && cubeId) updateCube(cubeId, { gyro: !gyro });
    else setAppGyro(!gyro);
  }, [cubeGyro, cubeId, gyro, setAppGyro]);
  const resetGyro = useCallback(() => session?.calibrate(), [session]);
  const supported = !!session?.info.capabilities.gyroscope;
  return { gyro, supported, appGyro, setAppGyro, cubeGyro, toggleGyro, resetGyro };
}
