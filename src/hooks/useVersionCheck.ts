/**
 * Detects that a NEWER build has been deployed than the one currently
 * running: polls version.json (emitted next to index.html at build time,
 * see vite.config.ts) and compares its buildId against the one baked into
 * this bundle. Static-hosting-friendly (GitHub Pages) — no service worker.
 *
 * Checks every 5 minutes plus whenever the tab regains focus/visibility —
 * the "came back to a stale tab" moment is when an update is most likely
 * waiting. `cache: "no-store"` + a timestamp query defeat both browser and
 * GH Pages CDN caching (~10 min) on the version file itself.
 *
 * Once true, stays true — the only way forward is the reload the
 * UpdateNotice popup asks for.
 */

import { useEffect, useState } from "react";

const CHECK_INTERVAL_MS = 5 * 60_000;

export function useVersionCheck(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // The dev server never serves version.json (build-only asset) — and
    // hot reload makes the concept meaningless there anyway.
    if (!import.meta.env.PROD) return;

    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        if (!cancelled && data.buildId && data.buildId !== __BUILD_ID__) setUpdateAvailable(true);
      } catch {
        // Offline / transient — the next tick will try again.
      }
    };

    const intervalId = setInterval(() => void check(), CHECK_INTERVAL_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    void check();

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return updateAvailable;
}
