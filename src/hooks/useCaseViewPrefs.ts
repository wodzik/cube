/**
 * Back-stickers / flat-view preferences for the big training cube views
 * (Solve, Practice, Attack, Academy, Trainer).
 *
 * Two independent buckets shared app-wide:
 *   - "f2l"   — F2L contexts, where seeing the hidden faces matters most.
 *               Defaults ON.
 *   - "other" — everything else (OLL/PLL drills, cross/roux trainers, full
 *               solves). Defaults OFF — occasionally useful, so the toggles
 *               are still there.
 *
 * A page passes `isF2l` for what it currently shows; toggling only writes
 * that bucket, so e.g. enabling flat view for an OLL drill doesn't change
 * the F2L experience.
 */

import { useCallback, useEffect, useState } from "react";

type Pref = "backStickers" | "flatView";
type Bucket = "f2l" | "other";

const KEYS: Record<Pref, Record<Bucket, string>> = {
  backStickers: { f2l: "nact_view_back_stickers_f2l", other: "nact_view_back_stickers_other" },
  flatView: { f2l: "nact_view_flat_view_f2l", other: "nact_view_flat_view_other" },
};

// The Case Trainer used to own these prefs for its F2L drills — carry an
// existing choice over so it survives the switch to the shared keys.
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

function load(pref: Pref, bucket: Bucket): boolean {
  const stored = localStorage.getItem(KEYS[pref][bucket]);
  if (stored !== null) return stored === "true";
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

export function useCaseViewPrefs(isF2l: boolean): CaseViewPrefs {
  const bucket: Bucket = isF2l ? "f2l" : "other";
  const [backStickers, setBackStickers] = useState(() => load("backStickers", bucket));
  const [flatView, setFlatView] = useState(() => load("flatView", bucket));
  const [hintElevation, setHintElevationState] = useState(loadElevation);

  // Re-read when the page switches context (e.g. Practice going OLL -> F2L).
  useEffect(() => {
    setBackStickers(load("backStickers", bucket));
    setFlatView(load("flatView", bucket));
  }, [bucket]);

  const toggleBackStickers = useCallback(() => {
    setBackStickers((v) => {
      const next = !v;
      localStorage.setItem(KEYS.backStickers[bucket], String(next));
      return next;
    });
  }, [bucket]);

  const toggleFlatView = useCallback(() => {
    setFlatView((v) => {
      const next = !v;
      localStorage.setItem(KEYS.flatView[bucket], String(next));
      return next;
    });
  }, [bucket]);

  const setHintElevation = useCallback((value: number) => {
    localStorage.setItem(ELEVATION_KEY, String(value));
    setHintElevationState(value);
  }, []);

  return { backStickers, flatView, hintElevation, toggleBackStickers, toggleFlatView, setHintElevation };
}
