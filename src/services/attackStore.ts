/**
 * Persistent storage for Attack session results (OLL, PLL, and the four
 * F2L slots — any AlgGroup the AttackPage offers).
 * localStorage keys: attack_sessions_<group>, e.g. attack_sessions_oll,
 * attack_sessions_f2l-front-right.
 * PURE FUNCTIONS — no React hooks.
 */

import type { AlgGroup } from "../types/algorithm";

export interface AttackCaseTime {
  caseName: string;
  timeMs: number;
}

export interface AttackSession {
  id: string;
  date: number;
  group: AlgGroup;
  /** Total session duration in ms (first case start -> last case complete). */
  totalMs: number;
  caseTimes: AttackCaseTime[];
}

function key(group: AlgGroup): string {
  return `attack_sessions_${group}`;
}

function readJson<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getAttackSessions(group: AlgGroup): AttackSession[] {
  return readJson<AttackSession[]>(key(group), []);
}

export function saveAttackSession(session: AttackSession): void {
  const sessions = getAttackSessions(session.group);
  sessions.push(session);
  localStorage.setItem(key(session.group), JSON.stringify(sessions));
}
