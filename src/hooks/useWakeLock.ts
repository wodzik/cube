/**
 * Keep the screen awake while the page is visible, via the native Screen
 * Wake Lock API — no library needed (Chrome/Edge/Android, Safari 16.4+).
 *
 * During a solve the user turns the cube, not the mouse/keyboard/touchscreen,
 * so the OS sees no input and dims or locks the screen mid-attempt. A screen
 * wake lock only holds while its tab is visible — the browser auto-releases
 * it when the tab is hidden (so a backgrounded tab never drains the battery)
 * and it does NOT come back by itself, hence the re-acquire on
 * visibilitychange.
 */

import { useEffect } from "react";

export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;

    const acquire = async () => {
      try {
        const s = await navigator.wakeLock.request("screen");
        if (stopped) {
          await s.release();
          return;
        }
        sentinel = s;
      } catch {
        // Denied (e.g. battery saver mode) — nothing useful to do.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void sentinel?.release().catch(() => undefined);
    };
  }, []);
}
