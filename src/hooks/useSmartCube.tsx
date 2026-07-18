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
 * smartcube-web-bluetooth already normalizes this across brands into one
 * `MOVE` event shape with a ready-to-use notation string (event.move).
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
import {
  connectSmartCube,
  getCachedMacForDevice,
  type SmartCubeConnection,
} from "smartcube-web-bluetooth";
import type { DeviceConnection } from "../types/hardware";
import { INITIAL_DEVICE_CONNECTION } from "../types/hardware";

type MoveListener = (move: string, timestampMs: number) => void;

interface SmartCubeContextValue extends DeviceConnection {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
  /** Register a move listener; returns an unsubscribe function. */
  addMoveListener: (fn: MoveListener) => () => void;
}

const SmartCubeContext = createContext<SmartCubeContextValue | null>(null);

/** Mount once at the app root, above any tab/route switching. */
export function SmartCubeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DeviceConnection>(INITIAL_DEVICE_CONNECTION);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<SmartCubeConnection | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
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
      const conn = await connectSmartCube({
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

      setState({
        connected: true,
        deviceName: conn.deviceName,
        protocolId: conn.protocol.id,
        battery: null,
      });

      subscriptionRef.current = conn.events$.subscribe((event) => {
        switch (event.type) {
          case "MOVE":
            for (const listener of listenersRef.current) {
              listener(event.move, event.localTimestamp ?? event.timestamp);
            }
            break;
          case "BATTERY":
            setState((s) => ({ ...s, battery: event.batteryLevel }));
            break;
          case "DISCONNECT":
            subscriptionRef.current?.unsubscribe();
            subscriptionRef.current = null;
            connectionRef.current = null;
            setState(INITIAL_DEVICE_CONNECTION);
            break;
        }
      });

      if (conn.capabilities.battery) {
        conn.sendCommand({ type: "REQUEST_BATTERY" }).catch(() => undefined);
      }
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

  const value = useMemo<SmartCubeContextValue>(
    () => ({ ...state, error, connect, disconnect, addMoveListener }),
    [state, error, connect, disconnect, addMoveListener]
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
