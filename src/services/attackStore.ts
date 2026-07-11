/**
 * Persistent storage for OLL/PLL Attack session results.
 * localStorage keys: attack_sessions_oll / attack_sessions_pll
 * PURE FUNCTIONS — no React hooks.
 */

export interface AttackCaseTime {
  caseName: string;
  timeMs: number;
}

export interface AttackSession {
  id: string;
  date: number;
  group: "oll" | "pll";
  /** Total session duration in ms (first case start -> last case complete). */
  totalMs: number;
  caseTimes: AttackCaseTime[];
}

function key(group: "oll" | "pll"): string {
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

export function getAttackSessions(group: "oll" | "pll"): AttackSession[] {
  return readJson<AttackSession[]>(key(group), []);
}

export function saveAttackSession(session: AttackSession): void {
  const sessions = getAttackSessions(session.group);
  sessions.push(session);
  localStorage.setItem(key(session.group), JSON.stringify(sessions));
}
