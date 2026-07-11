/**
 * Adapter hook: GAN Smart Timer (BT) → session start/stop signals.
 *
 * ADAPTER PATTERN — no business logic. Maps the timer's RUNNING/STOPPED
 * states onto signalStart("timer-device")/signalStop("timer-device").
 * Inactive unless timer-device is configured as the start or stop method.
 *
 * The physical timer's own firmware already implements the "hold both hands
 * down for a grace delay, then lift to start" mechanic (see GanTimerState:
 * HANDS_ON -> GET_SET -> RUNNING, or HANDS_ON -> HANDS_OFF if lifted too
 * early) — unlike spacebar, there is no JS-side minimum-hold logic to add
 * here, the hardware enforces it. pressState just mirrors those intermediate
 * states for UI feedback, using the same "idle" | "holding" | "armed"
 * vocabulary as useSpacebar so SolvePage can show one unified indicator
 * regardless of which input method is active.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { connectGanTimer, GanTimerState, type GanTimerConnection } from "smartcube-web-bluetooth";
import { useSession } from "../state/sessionContext";
import type { DeviceConnection } from "../types/hardware";
import { INITIAL_DEVICE_CONNECTION } from "../types/hardware";

export type TimerPressState = "idle" | "holding" | "armed";

export interface UseTimerDeviceReturn extends DeviceConnection {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
  pressState: TimerPressState;
}

export function useTimerDevice(): UseTimerDeviceReturn {
  const { state, signalStart, signalStop } = useSession();
  const [connection, setConnection] = useState<DeviceConnection>(INITIAL_DEVICE_CONNECTION);
  const [error, setError] = useState<string | null>(null);
  const [pressState, setPressState] = useState<TimerPressState>("idle");

  const stateRef = useRef(state);
  stateRef.current = state;
  const signalStartRef = useRef(signalStart);
  signalStartRef.current = signalStart;
  const signalStopRef = useRef(signalStop);
  signalStopRef.current = signalStop;

  const connRef = useRef<GanTimerConnection | null>(null);
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);

  const disconnect = useCallback(async () => {
    subRef.current?.unsubscribe();
    subRef.current = null;
    connRef.current?.disconnect();
    connRef.current = null;
    setConnection(INITIAL_DEVICE_CONNECTION);
    setPressState("idle");
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const conn = await connectGanTimer();
      connRef.current = conn;
      setConnection({ connected: true, deviceName: "GAN Timer", protocolId: "gan-timer", battery: null });

      subRef.current = conn.events$.subscribe((event) => {
        switch (event.state) {
          case GanTimerState.HANDS_ON:
            setPressState("holding");
            break;
          case GanTimerState.GET_SET:
            setPressState("armed");
            break;
          case GanTimerState.HANDS_OFF:
          case GanTimerState.IDLE:
            setPressState("idle");
            break;
          case GanTimerState.RUNNING:
            setPressState("idle");
            if (stateRef.current.config.startMethod.includes("timer-device")) {
              signalStartRef.current("timer-device");
            }
            break;
          case GanTimerState.STOPPED:
            if (stateRef.current.config.stopMethod.includes("timer-device")) {
              signalStopRef.current("timer-device");
            }
            break;
          case GanTimerState.DISCONNECT:
            subRef.current?.unsubscribe();
            subRef.current = null;
            connRef.current = null;
            setConnection(INITIAL_DEVICE_CONNECTION);
            setPressState("idle");
            break;
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to timer");
    }
  }, []);

  useEffect(() => {
    return () => {
      subRef.current?.unsubscribe();
      connRef.current?.disconnect();
    };
  }, []);

  return { ...connection, error, connect, disconnect, pressState };
}
