/**
 * Smart cube (BT) connection — shared across the whole app via context.
 *
 * BUG THIS FIXES: previously each page (Solve/Training/Attack) called a
 * self-contained hook that owned its own connection and disconnected on
 * unmount. Since this is a tab-based SPA, switching tabs unmounts the
 * previous page — which was tearing down the real Bluetooth connection on
 * every navigation. A Web Bluetooth GATT connection has nothing to do with
 * which "page" is showing; it belongs to the app, not the page.
 *
 * SmartCubeProvider owns the actual connection once, mounted at the app
 * root (above tab switching). Pages call useSmartCube({ onMove }) exactly
 * as before — same API — but now it just registers a move listener against
 * the shared connection instead of creating a new one.
 *
 * ADAPTER PATTERN — no business logic here. What a caller does with a move
 * (dispatch to a reducer, feed a tracker, etc.) is not this module's
 * concern — see sessionReducer / sequenceTracker.
 *
 * Every move from real hardware is a single physical face quarter-turn.
 * The connection is a cubecore SmartCubeSession (over smartcube-web-bluetooth):
 * moves come with the cube's own clock mapped onto the page's, the tracked
 * state, the gyro, and a skin that suits the connected cube (by its name).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getCachedMacForDevice } from "smartcube-web-bluetooth";
import { SmartCubeSession } from "@cubecore/bluetooth";
import { formatMove } from "@cubecore/core";
import { SKINS } from "@cubecore/skin";
import type { DeviceConnection } from "../types/hardware";
import { INITIAL_DEVICE_CONNECTION } from "../types/hardware";

type MoveListener = (move: string, timestampMs: number) => void;

interface SmartCubeContextValue extends DeviceConnection {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
  /** The live session (state, gyro, mark solved…), or null when not connected. */
  session: SmartCubeSession | null;
  /** Name of the skin that suits the connected cube (its brand / model), or null. */
  suggestedSkin: string | null;
  /** Register a move listener; returns an unsubscribe function. */
  addMoveListener: (fn: MoveListener) => () => void;
}

const SmartCubeContext = createContext<SmartCubeContextValue | null>(null);

/** Mount once at the app root, above any tab/route switching. */
export function SmartCubeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DeviceConnection>(INITIAL_DEVICE_CONNECTION);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<SmartCubeSession | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const [session, setSession] = useState<SmartCubeSession | null>(null);
  const [suggestedSkin, setSuggestedSkin] = useState<string | null>(null);
  const listenersRef = useRef(new Set<MoveListener>());

  const addMoveListener = useCallback((fn: MoveListener) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  const disconnect = useCallback(async () => {
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;
    await connectionRef.current?.disconnect().catch(() => undefined);
    connectionRef.current = null;
    setSession(null);
    setSuggestedSkin(null);
    setState(INITIAL_DEVICE_CONNECTION);
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try {
      // QiYi cubes need their MAC address for the encryption handshake.
      // enableAddressSearch turns on the library's MAC probing (candidates
      // derived from the device name) — the path that works when the browser
      // exposes no advertisement data (desktop Chrome without the
      // web-platform-features flag). The provider is the last-resort fallback:
      // ask the user to type the MAC in manually.
      const conn = await SmartCubeSession.connect({
        enableAddressSearch: true,
        macAddressProvider: async (device, isFallbackCall) => {
          if (!isFallbackCall) return null;
          const flagHint =
            typeof device.watchAdvertisements !== "function"
              ? "\n\nOn Chrome, automatic discovery may work if you enable\nchrome://flags/#enable-experimental-web-platform-features"
              : "";
          return window.prompt(
            `Unable to determine cube MAC address.\nPlease enter it manually:${flagHint}`,
            getCachedMacForDevice(device) ?? ""
          );
        },
      });
      connectionRef.current = conn;
      setSession(conn);

      setState({
        connected: true,
        deviceName: conn.info.name,
        protocolId: conn.info.protocol.id,
        battery: conn.battery,
      });
      // The skin for this cube, by its brand / name (refined when the hardware name arrives).
      const nameOfSkin = () => (Object.keys(SKINS) as (keyof typeof SKINS)[]).find((k) => SKINS[k] === conn.suggestedSkin) ?? null;
      setSuggestedSkin(nameOfSkin());

      const offs = [
        conn.on("move", (e) => {
          const move = formatMove(e.move);
          for (const listener of listenersRef.current) listener(move, e.time);
        }),
        conn.on("battery", (level) => setState((s) => ({ ...s, battery: level }))),
        conn.on("hardware", () => setSuggestedSkin(nameOfSkin())),
        conn.on("disconnect", () => {
          subscriptionRef.current?.unsubscribe();
          subscriptionRef.current = null;
          connectionRef.current = null;
          setSession(null);
          setSuggestedSkin(null);
          setState(INITIAL_DEVICE_CONNECTION);
        }),
      ];
      subscriptionRef.current = { unsubscribe: () => offs.forEach((off) => off()) };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to cube");
    }
  }, []);

  // Disconnect only when the PROVIDER unmounts — i.e. the app closing, not a
  // tab switch (the provider lives above tab switching in App.tsx).
  useEffect(() => {
    return () => {
      subscriptionRef.current?.unsubscribe();
      connectionRef.current?.disconnect().catch(() => undefined);
    };
  }, []);

  // Dev-only escape hatch: inject a synthetic move exactly as if it came
  // from hardware — lets headless tests and console debugging drive every
  // move-consuming feature without a physical cube. Not compiled into
  // production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __nactSimulateMove?: (move: string) => number };
    w.__nactSimulateMove = (move: string) => {
      for (const listener of listenersRef.current) listener(move, performance.now());
      return listenersRef.current.size;
    };
    return () => {
      delete w.__nactSimulateMove;
    };
  }, []);

  // Dev-only escape hatch: flip `connected` without a real BT device — lets
  // console/test driving of disconnect-triggered behavior (e.g.
  // SessionProvider's abort-on-disconnect) without physical hardware.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __nactSimulateConnected?: (connected: boolean) => void };
    w.__nactSimulateConnected = (connected: boolean) => {
      setState((s) => (connected ? { ...s, connected: true } : INITIAL_DEVICE_CONNECTION));
    };
    return () => {
      delete w.__nactSimulateConnected;
    };
  }, []);

  const value = useMemo<SmartCubeContextValue>(
    () => ({ ...state, error, connect, disconnect, addMoveListener, session, suggestedSkin }),
    [state, error, connect, disconnect, addMoveListener, session, suggestedSkin]
  );

  return <SmartCubeContext.Provider value={value}>{children}</SmartCubeContext.Provider>;
}

export interface UseSmartCubeOptions {
  /** Called for every physical quarter-turn, in order, with a local timestamp (performance.now()-based). */
  onMove?: (move: string, timestampMs: number) => void;
}

export interface UseSmartCubeReturn extends DeviceConnection {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
  session: SmartCubeSession | null;
  suggestedSkin: string | null;
}

/** The shared connection without subscribing to moves (for views that only need the session / skin); null outside the provider. */
export function useSmartCubeConnection(): Omit<SmartCubeContextValue, "addMoveListener"> | null {
  return useContext(SmartCubeContext);
}

/** Same API as before — pages don't need to change. Now backed by the shared connection. */
export function useSmartCube(options: UseSmartCubeOptions = {}): UseSmartCubeReturn {
  const ctx = useContext(SmartCubeContext);
  if (!ctx) throw new Error("useSmartCube must be used within a SmartCubeProvider (mount it in App.tsx)");

  const { addMoveListener, ...connection } = ctx;

  const onMoveRef = useRef(options.onMove);
  onMoveRef.current = options.onMove;

  useEffect(() => {
    return addMoveListener((move, timestampMs) => onMoveRef.current?.(move, timestampMs));
  }, [addMoveListener]);

  return connection;
}
