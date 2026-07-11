/**
 * Audible inspection warnings: one beep with 7 seconds left, a higher
 * double beep with 3 seconds left. For the official 15s WCA inspection
 * these land exactly at 8s and 12s elapsed — the moments a WCA judge calls
 * out — and the same remaining-time thresholds carry over naturally to
 * custom-length countdowns (a threshold is skipped when the countdown is
 * too short for it, e.g. a 5s inspection only gets the 3s beep).
 *
 * Sound via Web Audio, no assets. The AudioContext is created lazily on
 * first beep and reused; resume() guards against Safari/WebKit starting
 * contexts suspended when created outside a user gesture (by inspection
 * time the user has long since interacted, so resume succeeds).
 */

import { useEffect, useRef } from "react";

const BEEP_THRESHOLDS_SEC = [7, 3] as const;

let audioCtx: AudioContext | null = null;

function playBeep(frequency: number, count: number): void {
  try {
    audioCtx ??= new AudioContext();
    void audioCtx.resume();
    const now = audioCtx.currentTime;
    for (let i = 0; i < count; i++) {
      const start = now + i * 0.18;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      // Short attack/release envelope — a bare start/stop clicks audibly.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.01);
      gain.gain.setValueAtTime(0.25, start + 0.09);
      gain.gain.linearRampToValueAtTime(0, start + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.13);
    }
  } catch {
    // No audio available (permissions, headless, etc.) — beeps are a nicety, never break inspection over them.
  }
}

export function useInspectionBeeps(isInspecting: boolean, secondsLeft: number, durationSeconds: number): void {
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!isInspecting) {
      firedRef.current.clear();
      return;
    }
    for (const threshold of BEEP_THRESHOLDS_SEC) {
      // threshold < duration: a 5s custom inspection starts already past
      // the 7s mark — beeping instantly at the start would be noise, not a
      // warning.
      if (threshold < durationSeconds && secondsLeft <= threshold && !firedRef.current.has(threshold)) {
        firedRef.current.add(threshold);
        playBeep(threshold === 3 ? 1320 : 880, threshold === 3 ? 2 : 1);
      }
    }
  }, [isInspecting, secondsLeft, durationSeconds]);
}
