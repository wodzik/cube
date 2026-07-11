/**
 * Persistent storage for speed solve data. localStorage only, no backend.
 * PURE FUNCTIONS — no React hooks.
 */

import type { SolveRecord, StoredSession } from "../types/solve";

const SOLVES_KEY = "nact_solves";
const SESSIONS_KEY = "nact_sessions";

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

// ─── Solves ───

export function getSolves(): SolveRecord[] {
  return readJson<SolveRecord[]>(SOLVES_KEY, []);
}

export function getSolvesForSession(sessionId: string): SolveRecord[] {
  return getSolves().filter((s) => s.sessionId === sessionId);
}

export function saveSolve(solve: SolveRecord): void {
  const solves = getSolves();
  solves.push(solve);
  writeJson(SOLVES_KEY, solves);
}

/** Merge fields into an existing stored solve — used to self-heal legacy records (e.g. backfilling boundary lists added by newer builds, see SolveAnalysis). */
export function patchSolve(id: string, patch: Partial<Omit<SolveRecord, "id">>): void {
  const solves = getSolves();
  const idx = solves.findIndex((s) => s.id === id);
  if (idx >= 0) {
    solves[idx] = { ...solves[idx], ...patch };
    writeJson(SOLVES_KEY, solves);
  }
}

export function deleteSolve(id: string): void {
  writeJson(
    SOLVES_KEY,
    getSolves().filter((s) => s.id !== id)
  );
}

export function clearSolvesForSession(sessionId: string): void {
  writeJson(
    SOLVES_KEY,
    getSolves().filter((s) => s.sessionId !== sessionId)
  );
}

// ─── Sessions ───

/**
 * Backfills fields that didn't exist on StoredSession before per-session
 * settings were added — sessions created by an older build of this app are
 * still sitting in localStorage without `inputMethod`/`startingStage`.
 * Without this, a legacy session's `startingStage` reads as `undefined`,
 * which fails the `=== "scratch"` check wherever it's used and silently
 * routes every attempt into the manual-setup flow (no scramble ever
 * generated) instead of its original scratch behavior.
 */
function normalizeSession(session: StoredSession): StoredSession {
  return {
    ...session,
    inputMethod: session.inputMethod ?? "cube",
    startingStage: session.startingStage ?? "scratch",
    solveMethod: session.solveMethod ?? "CFOP",
    customInspectionSeconds: session.customInspectionSeconds ?? 15,
  };
}

export function getSessions(): StoredSession[] {
  const raw = readJson<StoredSession[]>(SESSIONS_KEY, []);
  const normalized = raw.map(normalizeSession);
  // Self-heal storage once so a direct localStorage export (SettingsPage's
  // backup) and future reads don't keep tripping over the same legacy gap.
  const changed = normalized.some(
    (s, i) =>
      s.inputMethod !== raw[i].inputMethod ||
      s.startingStage !== raw[i].startingStage ||
      s.solveMethod !== raw[i].solveMethod ||
      s.customInspectionSeconds !== raw[i].customInspectionSeconds
  );
  if (changed) writeJson(SESSIONS_KEY, normalized);
  return normalized;
}

export function saveSession(session: StoredSession): void {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);
  writeJson(SESSIONS_KEY, sessions);
}

export function deleteSession(id: string): void {
  writeJson(
    SESSIONS_KEY,
    getSessions().filter((s) => s.id !== id)
  );
}

/** Delete a session and every solve recorded under it — the two are always removed together, there's no orphaned-solve state to preserve. */
export function deleteSessionAndSolves(id: string): void {
  deleteSession(id);
  clearSolvesForSession(id);
}

export function updateSession(id: string, patch: Partial<Omit<StoredSession, "id">>): void {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx >= 0) {
    sessions[idx] = { ...sessions[idx], ...patch };
    writeJson(SESSIONS_KEY, sessions);
  }
}

/** Create a default session if none exist, return its id. */
export function ensureDefaultSession(): string {
  const sessions = getSessions();
  const existing = sessions.find((s) => s.name !== CUSTOM_SCRAMBLES_SESSION_NAME);
  if (existing) return existing.id;
  const session: StoredSession = {
    id: crypto.randomUUID(),
    name: "Main",
    inspectionMode: "wca",
    customInspectionSeconds: 15,
    inputMethod: "cube",
    startingStage: "scratch",
    solveMethod: "CFOP",
  };
  saveSession(session);
  return session.id;
}

/**
 * Fixed-name session that pasted/reused scrambles are routed into, so they
 * never mix into whichever session is currently active — mirrors the old
 * app's ensureCustomScrambleSession(). Found by name (not a flag) so it
 * round-trips through the plain export/import JSON backup unchanged.
 */
export const CUSTOM_SCRAMBLES_SESSION_NAME = "Custom Scrambles";

export function ensureCustomScramblesSession(): string {
  const existing = getSessions().find((s) => s.name === CUSTOM_SCRAMBLES_SESSION_NAME);
  if (existing) return existing.id;
  const session: StoredSession = {
    id: crypto.randomUUID(),
    name: CUSTOM_SCRAMBLES_SESSION_NAME,
    inspectionMode: "wca",
    customInspectionSeconds: 15,
    inputMethod: "cube",
    startingStage: "scratch",
    solveMethod: "CFOP",
  };
  saveSession(session);
  return session.id;
}
