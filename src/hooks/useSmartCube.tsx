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
 * concern — see sessionReducer.
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
import { SimulatedCube, SmartCubeSession } from "@cubecore/bluetooth";
import { type State, decodeState, encodeState, formatMove } from "@cubecore/core";
import { SKINS } from "@cubecore/skin";
import type { DeviceConnection } from "../types/hardware";
import { findCube, rememberCube, setActiveCube, updateCube } from "../services/cubeRegistry";
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
  /** The connected cube's id in the list of known cubes (services/cubeRegistry), or null. */
  cubeId: string | null;
  /**
   * Bumped whenever the cube's state changes other than by a move — "Mark
   * as solved", or the state the cube itself reports after connecting.
   * Pages planning from the state (scrambles, targets) plan again.
   */
  resyncs: number;
  /** Declare the connected cube solved (tracking drifted, or it was solved by hand while disconnected). */
  markSolved: () => void;
  /** Register a move listener; returns an unsubscribe function. */
  addMoveListener: (fn: MoveListener) => () => void;
  /**
   * The cube's state just before the move reported at `timestampMs` (one of
   * the recent ones), or null — lets a page that replays buffered moves find
   * where they started from.
   */
  stateBefore: (timestampMs: number) => State | null;
}

/** Recent moves remembered for stateBefore. */
const HISTORY = 200;

const SmartCubeContext = createContext<SmartCubeContextValue | null>(null);

/**
 * Ask the browser for a smart cube and open a session on it — the options
 * every connection uses (QiYi MAC probing / prompt; the "solved" reference
 * of a cube that can't reset, from the list of known cubes). Needs a user
 * gesture. The app's own cube goes through SmartCubeProvider; pages with
 * more cubes (Versus) open more with this.
 */
export async function openCubeSession(): Promise<SmartCubeSession> {
  return SmartCubeSession.connect(
    {
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
    },
    {
      // A cube that can't reset its own state: what it reports when solved, kept from "Mark as solved".
      base: (device) => {
        const kept = findCube(device)?.base;
        return kept ? decodeState(kept) : null;
      },
    }
  );
}

/** Remember a connected cube (Settings → My cubes) and keep its "solved" reference; returns its id and an unsubscribe. */
export function trackKnownCube(conn: SmartCubeSession): { cubeId: string; off: () => void } {
  const known = rememberCube({ name: conn.info.name, mac: conn.info.mac, protocol: conn.info.protocol.id });
  const off = conn.on("base", (b) => updateCube(known.id, { base: b ? (encodeState(b) ?? undefined) : undefined }));
  return { cubeId: known.id, off };
}

/** Mount once at the app root, above any tab/route switching. */
export function SmartCubeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DeviceConnection>(INITIAL_DEVICE_CONNECTION);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<SmartCubeSession | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const [session, setSession] = useState<SmartCubeSession | null>(null);
  const [suggestedSkin, setSuggestedSkin] = useState<string | null>(null);
  const [cubeId, setCubeId] = useState<string | null>(null);
  const [resyncs, setResyncs] = useState(0);
  const markSolved = useCallback(() => connectionRef.current?.markSolved(), []);
  const listenersRef = useRef(new Set<MoveListener>());
  const historyRef = useRef<{ time: number; before: State }[]>([]);
  const simulatedRef = useRef<SimulatedCube | null>(null);

  const stateBefore = useCallback((timestampMs: number) => historyRef.current.find((h) => h.time === timestampMs)?.before ?? null, []);

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
    simulatedRef.current = null;
    setSession(null);
    setSuggestedSkin(null);
    setActiveCube(null);
    setCubeId(null);
    setState(INITIAL_DEVICE_CONNECTION);
  }, []);

  /** Wire a connected session into the app (a real cube, or the dev simulator). */
  const use = useCallback((conn: SmartCubeSession) => {
    connectionRef.current = conn;
    setSession(conn);
    // Remember this cube (the list in Settings; records are stamped with its id).
    const { cubeId: knownId, off: keepBase } = trackKnownCube(conn);
    setActiveCube(knownId);
    setCubeId(knownId);

    setState({
      connected: true,
      deviceName: conn.info.name,
      protocolId: conn.info.protocol.id,
      battery: conn.battery,
    });
    // The skin for this cube, by its brand / name (refined when the hardware name arrives).
    const nameOfSkin = () => (Object.keys(SKINS) as (keyof typeof SKINS)[]).find((k) => SKINS[k] === conn.suggestedSkin) ?? null;
    setSuggestedSkin(nameOfSkin());

    historyRef.current = [];
    let before = conn.state;
    const offs = [
      conn.on("move", (e) => {
        historyRef.current.push({ time: e.time, before });
        if (historyRef.current.length > HISTORY) historyRef.current.shift();
        before = e.state;
        const move = formatMove(e.move);
        for (const listener of listenersRef.current) listener(move, e.time);
      }),
      // "Mark solved" / a resync from the cube: the next move starts from here.
      conn.on("state", (e) => {
        if (e.reason === "move") return;
        before = e.state;
        setResyncs((n) => n + 1);
      }),
      conn.on("battery", (level) => setState((s) => ({ ...s, battery: level }))),
      conn.on("hardware", () => setSuggestedSkin(nameOfSkin())),
      conn.on("disconnect", () => {
        subscriptionRef.current?.unsubscribe();
        subscriptionRef.current = null;
        connectionRef.current = null;
        simulatedRef.current = null;
        setSession(null);
        setSuggestedSkin(null);
        setState(INITIAL_DEVICE_CONNECTION);
      }),
    ];
    offs.push(keepBase);
    subscriptionRef.current = { unsubscribe: () => offs.forEach((off) => off()) };
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
      const conn = await openCubeSession();
      use(conn);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to cube");
    }
  }, [use]);

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
      // With a simulated cube connected, turn it (the session tracks the state like a real one).
      if (simulatedRef.current) simulatedRef.current.turn(move);
      else for (const listener of listenersRef.current) listener(move, performance.now());
      return listenersRef.current.size;
    };
    // A simulated smart cube: a real SmartCubeSession (state, events) without Bluetooth.
    const ws = window as unknown as { __nactSimulateConnect?: () => void; __nactCubeState?: () => State | null };
    ws.__nactCubeState = () => connectionRef.current?.state ?? null;
    ws.__nactSimulateConnect = () => {
      simulatedRef.current = new SimulatedCube();
      use(new SmartCubeSession(simulatedRef.current));
    };
    return () => {
      delete w.__nactSimulateMove;
      delete ws.__nactSimulateConnect;
      delete ws.__nactCubeState;
    };
  }, [use]);

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
    () => ({ ...state, error, connect, disconnect, addMoveListener, stateBefore, session, suggestedSkin, cubeId, resyncs, markSolved }),
    [state, error, connect, disconnect, addMoveListener, stateBefore, session, suggestedSkin, cubeId, resyncs, markSolved]
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
  cubeId: string | null;
  resyncs: number;
  markSolved: () => void;
}

/** The shared connection without subscribing to moves (for views that only need the session / skin); null outside the provider. */
export function useSmartCubeConnection(): Omit<SmartCubeContextValue, "addMoveListener"> | null {
  return useContext(SmartCubeContext);
}

/** Same API as before — pages don't need to change. Now backed by the shared connection. */
export function useSmartCube(options: UseSmartCubeOptions = {}): UseSmartCubeReturn {
  const ctx = useContext(SmartCubeContext);
  if (!ctx) throw new Error("useSmartCube must be used within a SmartCubeProvider (mount it in App.tsx)");

  const { addMoveListener, stateBefore: _stateBefore, ...connection } = ctx;

  const onMoveRef = useRef(options.onMove);
  onMoveRef.current = options.onMove;

  useEffect(() => {
    return addMoveListener((move, timestampMs) => onMoveRef.current?.(move, timestampMs));
  }, [addMoveListener]);

  return connection;
}
