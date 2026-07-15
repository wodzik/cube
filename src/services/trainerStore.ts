/**
 * Persistent storage for Case Trainer attempts. localStorage only, same
 * conventions as solveStore. PURE FUNCTIONS — no React hooks.
 */

import type { TrainerAttempt, TrainerType } from "../types/trainer";

const ATTEMPTS_KEY = "nact_trainer_attempts";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getTrainerAttempts(): TrainerAttempt[] {
  return readJson<TrainerAttempt[]>(ATTEMPTS_KEY, []);
}

/** Attempts for one difficulty class — (type, targetLength) is what defines comparable stats. */
export function getTrainerAttemptsFor(type: TrainerType, targetLength: number): TrainerAttempt[] {
  return getTrainerAttempts().filter((a) => a.type === type && a.targetLength === targetLength);
}

export function saveTrainerAttempt(attempt: TrainerAttempt): void {
  const attempts = getTrainerAttempts();
  attempts.push(attempt);
  writeJson(ATTEMPTS_KEY, attempts);
}

export function deleteTrainerAttempt(id: string): void {
  writeJson(
    ATTEMPTS_KEY,
    getTrainerAttempts().filter((a) => a.id !== id)
  );
}
