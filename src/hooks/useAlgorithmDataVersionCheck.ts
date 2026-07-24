/**
 * Flags that this bundle's built-in algorithm defaults are newer than what
 * the user last acknowledged (see algs/dataVersion.ts) — a dismissable
 * heads-up, unlike useVersionCheck's mandatory stale-bundle reload. No
 * polling: ALGORITHM_DATA_VERSION is baked into the bundle already running,
 * so a plain one-time comparison against localStorage is enough.
 *
 * First-ever run (key missing — fresh install, or an existing user
 * upgrading into the version that introduces this check) silently records
 * the current version instead of showing the notice — otherwise everyone
 * already on the app would get nagged the moment this feature ships.
 */
import { useEffect, useState } from "react";
import { ALGORITHM_DATA_VERSION } from "../algs/dataVersion";

const SEEN_KEY = "nact_seen_data_version";

export function useAlgorithmDataVersionCheck(): boolean {
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    const seenRaw = localStorage.getItem(SEEN_KEY);
    if (seenRaw === null) {
      localStorage.setItem(SEEN_KEY, String(ALGORITHM_DATA_VERSION));
      return;
    }
    if (Number(seenRaw) < ALGORITHM_DATA_VERSION) setShowNotice(true);
  }, []);

  return showNotice;
}

/** Call once the user has acted on the notice (dismissed or reset) so it doesn't reappear. */
export function acknowledgeAlgorithmDataVersion(): void {
  localStorage.setItem(SEEN_KEY, String(ALGORITHM_DATA_VERSION));
}
