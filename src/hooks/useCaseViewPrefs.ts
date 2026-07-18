/**
 * Back-stickers / flat-view preferences for the big training cube views.
 *
 * Remembered PER PAGE (each page passes its `scope`: "solve", "practice",
 * "attack", "academy", "trainer") — toggling on one page never changes
 * another; each view stays the way it was left. Within a page there are
 * still two buckets:
 *   - "f2l"   — F2L contexts, where seeing the hidden faces matters most.
 *               Defaults ON.
 *   - "other" — everything else (OLL/PLL drills, cross/roux trainers, full
 *               solves). Defaults OFF — occasionally useful, so the toggles
 *               are still there.
 *
 * The hint-sticker distance stays a single global value — it's an
 * aesthetic preference, not a per-drill one.
 */

import { useCallback, useEffect, useState } from "react";

type Pref = "backStickers" | "flatView";
type Bucket = "f2l" | "other";
export type CaseViewScope = "solve" | "practice" | "attack" | "academy" | "trainer";

const KEY_STEMS: Record<Pref, string> = {
  backStickers: "nact_view_back_stickers",
  flatView: "nact_view_flat_view",
};

function key(pref: Pref, scope: CaseViewScope, bucket: Bucket): string {
  return `${KEY_STEMS[pref]}_${scope}_${bucket}`;
}

// Earlier revisions stored one app-wide value per bucket (and before that,
// trainer-only keys) — carry an existing choice over as the per-page seed.
const SHARED_KEYS: Record<Pref, Record<Bucket, string>> = {
  backStickers: { f2l: "nact_view_back_stickers_f2l", other: "nact_view_back_stickers_other" },
  flatView: { f2l: "nact_view_flat_view_f2l", other: "nact_view_flat_view_other" },
};
const LEGACY_F2L_KEYS: Record<Pref, string> = {
  backStickers: "nact_trainer_back_stickers",
  flatView: "nact_trainer_flat_view",
};

// How far the hint stickers float from the cube, in Cube3D elevation units
// (main stickers sit at 0.503; the library's "auto" default is 1.45). One
// global value — the preferred distance is an aesthetic choice, not a
// per-drill one.
const ELEVATION_KEY = "nact_view_hint_elevation";
export const DEFAULT_HINT_ELEVATION = 1.45;
export const MIN_HINT_ELEVATION = 0.6;
export const MAX_HINT_ELEVATION = 3;

function loadElevation(): number {
  const stored = Number(localStorage.getItem(ELEVATION_KEY));
  return Number.isFinite(stored) && stored >= MIN_HINT_ELEVATION && stored <= MAX_HINT_ELEVATION
    ? stored
    : DEFAULT_HINT_ELEVATION;
}

function load(pref: Pref, scope: CaseViewScope, bucket: Bucket): boolean {
  const stored = localStorage.getItem(key(pref, scope, bucket));
  if (stored !== null) return stored === "true";
  const shared = localStorage.getItem(SHARED_KEYS[pref][bucket]);
  if (shared !== null) return shared === "true";
  if (bucket === "f2l") {
    const legacy = localStorage.getItem(LEGACY_F2L_KEYS[pref]);
    if (legacy !== null) return legacy === "true";
    return true;
  }
  return false;
}

export interface CaseViewPrefs {
  backStickers: boolean;
  flatView: boolean;
  /** Distance of the floating hint stickers from the cube (Cube3D elevation units). */
  hintElevation: number;
  toggleBackStickers: () => void;
  toggleFlatView: () => void;
  setHintElevation: (value: number) => void;
}

export function useCaseViewPrefs(isF2l: boolean, scope: CaseViewScope): CaseViewPrefs {
  const bucket: Bucket = isF2l ? "f2l" : "other";
  const [backStickers, setBackStickers] = useState(() => load("backStickers", scope, bucket));
  const [flatView, setFlatView] = useState(() => load("flatView", scope, bucket));
  const [hintElevation, setHintElevationState] = useState(loadElevation);

  // Re-read when the page switches context (e.g. Practice going OLL -> F2L).
  useEffect(() => {
    setBackStickers(load("backStickers", scope, bucket));
    setFlatView(load("flatView", scope, bucket));
  }, [scope, bucket]);

  const toggleBackStickers = useCallback(() => {
    setBackStickers((v) => {
      const next = !v;
      localStorage.setItem(key("backStickers", scope, bucket), String(next));
      return next;
    });
  }, [scope, bucket]);

  const toggleFlatView = useCallback(() => {
    setFlatView((v) => {
      const next = !v;
      localStorage.setItem(key("flatView", scope, bucket), String(next));
      return next;
    });
  }, [scope, bucket]);

  const setHintElevation = useCallback((value: number) => {
    localStorage.setItem(ELEVATION_KEY, String(value));
    setHintElevationState(value);
  }, []);

  return { backStickers, flatView, hintElevation, toggleBackStickers, toggleFlatView, setHintElevation };
}
