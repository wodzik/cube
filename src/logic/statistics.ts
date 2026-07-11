import type { AlgorithmAttempt, AttemptSource } from "../types/algorithm";

/**
 * WCA-style statistics for solve times.
 * Pure functions, no side effects.
 */

/**
 * WCA average: take last N times, sort them, remove best and worst,
 * average the rest. Returns null if not enough times.
 */
export function wcaAverage(times: number[], n: number): number | null {
  if (times.length < n) return null;
  const last = times.slice(-n);
  const sorted = [...last].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1); // remove min and max
  return trimmed.reduce((sum, t) => sum + t, 0) / trimmed.length;
}

export function ao5(times: number[]): number | null {
  return wcaAverage(times, 5);
}

export function ao12(times: number[]): number | null {
  return wcaAverage(times, 12);
}

export function ao100(times: number[]): number | null {
  return wcaAverage(times, 100);
}

export function best(times: number[]): number | null {
  if (times.length === 0) return null;
  return Math.min(...times);
}

export function mean(times: number[]): number | null {
  if (times.length === 0) return null;
  return times.reduce((sum, t) => sum + t, 0) / times.length;
}

export function computeVariantStats(times: number[]): {
  ao5: number | null;
  ao12: number | null;
  ao100: number | null;
  bestTime: number | null;
} {
  return {
    ao5: ao5(times),
    ao12: ao12(times),
    ao100: ao100(times),
    bestTime: best(times),
  };
}

// ─── AlgorithmAttempt versions ───

/**
 * Extract times from attempts array for statistics calculation.
 */
function extractTimes(attempts: AlgorithmAttempt[]): number[] {
  return attempts.map((a) => a.time);
}

/**
 * WCA average for algorithm attempts.
 */
export function wcaAverageAttempts(
  attempts: AlgorithmAttempt[],
  n: number
): number | null {
  return wcaAverage(extractTimes(attempts), n);
}

export function ao5Attempts(attempts: AlgorithmAttempt[]): number | null {
  return wcaAverageAttempts(attempts, 5);
}

export function ao12Attempts(attempts: AlgorithmAttempt[]): number | null {
  return wcaAverageAttempts(attempts, 12);
}

export function ao100Attempts(attempts: AlgorithmAttempt[]): number | null {
  return wcaAverageAttempts(attempts, 100);
}

export function bestAttempt(attempts: AlgorithmAttempt[]): number | null {
  return best(extractTimes(attempts));
}

export function meanAttempts(attempts: AlgorithmAttempt[]): number | null {
  return mean(extractTimes(attempts));
}

export function computeVariantStatsAttempts(attempts: AlgorithmAttempt[]): {
  ao5: number | null;
  ao12: number | null;
  ao100: number | null;
  bestTime: number | null;
} {
  const times = extractTimes(attempts);
  return {
    ao5: ao5(times),
    ao12: ao12(times),
    ao100: ao100(times),
    bestTime: best(times),
  };
}

// ─── Per-source (Training vs Attack) versions ───
//
// Training and Attack both call recordAttempt into the same variant.times
// array, but they're different practice contexts — pooling their times
// would show a Training PB that was actually set during an Attack run (or
// vice versa), which is misleading. These filter by AlgorithmAttempt.source
// before computing anything. Attempts recorded before `source` existed have
// no tag; they're treated as "training", since that was the only mode that
// existed when they were recorded.

export function attemptsForSource(attempts: AlgorithmAttempt[], source: AttemptSource): AlgorithmAttempt[] {
  return attempts.filter((a) => (a.source ?? "training") === source);
}

export function computeVariantStatsForSource(
  attempts: AlgorithmAttempt[],
  source: AttemptSource
): {
  ao5: number | null;
  ao12: number | null;
  ao100: number | null;
  bestTime: number | null;
  mean: number | null;
  count: number;
} {
  const filtered = attemptsForSource(attempts, source);
  return {
    ...computeVariantStatsAttempts(filtered),
    mean: meanAttempts(filtered),
    count: filtered.length,
  };
}

/**
 * Format milliseconds to display string with 3 decimal places.
 *   < 60s  → "12.345"
 *   ≥ 60s  → "1:02.345"
 */
export function formatTimeMs(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) {
    return seconds.toFixed(3);
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
}

/**
 * Format seconds to display string with 2 decimal places.
 *   < 60s  → "12.34"
 *   ≥ 60s  → "1:02.34"
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return seconds.toFixed(2);
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(2).padStart(5, "0")}`;
}
