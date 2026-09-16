/**
 * Persistent storage for speed solve data. localStorage only, no backend.
 * PURE FUNCTIONS — no React hooks.
 */

import type { SolveRecord, StoredSession } from "../types/solve";
import type { MoveRecord } from "../types/session";
import { collapseIdenticalMoves } from "../logic/moveReduction";

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

function isQuotaExceededError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22);
}

// ─── Solves: compact on-disk shape ───
//
// A SolveRecord as used by the rest of the app carries three fields that
// are pure, cheap-to-recompute functions of the others: every persisted
// move's `phase` is always "active" (moves are only appended once the
// timed solve itself starts — scrambling-phase moves never reach a saved
// record), `timestamp` is exactly `timerStartedAt + relativeMs`, and
// `reducedMoves`/`scrambleMoves` are exactly `collapseIdenticalMoves(...)`/
// a split of `scramble`. Storing all four anyway roughly doubled every
// solve's on-disk footprint for no benefit — across enough solves that's
// most of what pushes nact_solves toward localStorage's quota (see the
// QuotaExceededError reports, and writeSolvesWithQuotaFallback below).
// Persisted records drop them; getSolves() reconstructs the full
// SolveRecord shape on read, so every OTHER file keeps working unchanged.
type StoredMoveRecord = Pick<MoveRecord, "move" | "relativeMs">;
type StoredSolveRecord = Omit<SolveRecord, "moves" | "reducedMoves" | "scrambleMoves"> & {
  moves: StoredMoveRecord[];
};

function compactSolve(record: SolveRecord): StoredSolveRecord {
  const { reducedMoves: _reducedMoves, scrambleMoves: _scrambleMoves, moves, ...rest } = record;
  return { ...rest, moves: moves.map(({ move, relativeMs }) => ({ move, relativeMs })) };
}

function hydrateSolve(stored: StoredSolveRecord): SolveRecord {
  const moves: MoveRecord[] = stored.moves.map(({ move, relativeMs }) => ({
    move,
    relativeMs,
    timestamp: stored.timerStartedAt + relativeMs,
    phase: "active",
  }));
  return {
    ...stored,
    moves,
    reducedMoves: collapseIdenticalMoves(moves.map((m) => m.move)),
    scrambleMoves: stored.scramble.trim().split(/\s+/).filter(Boolean),
  };
}

/** True if a raw parsed record still carries the old, bigger shape (pre-compaction) — see getSolves()'s self-heal. */
function isLegacyShape(raw: unknown): boolean {
  const r = raw as { reducedMoves?: unknown; scrambleMoves?: unknown; moves?: { phase?: unknown; timestamp?: unknown }[] };
  if (r.reducedMoves !== undefined || r.scrambleMoves !== undefined) return true;
  return r.moves?.some((m) => m.phase !== undefined || m.timestamp !== undefined) ?? false;
}

/**
 * Even after dropping the redundant fields above, the raw per-move log
 * (SolveRecord.moves) still dominates a heavily-used session's storage, so
 * the solves array can still outgrow localStorage's quota eventually.
 * Rather than let that throw out of saveSolve mid-solve (crashing the app
 * right after the user finishes a cube — see the QuotaExceededError
 * reports), evict the oldest solves in increasing chunks and retry until
 * the write fits.
 *
 * If it still doesn't fit down to just the brand-new solve alone, the real
 * problem is the ORIGIN's total localStorage usage (every session's other
 * keys — algorithm groups, etc.), not this one array — nothing left to cut
 * here will fix that. Giving up by re-throwing would crash the app on
 * every future solve, which is strictly worse than silently not persisting
 * one, so this logs loudly and returns instead of throwing once eviction
 * is exhausted.
 */
function writeSolvesWithQuotaFallback(solves: SolveRecord[]): void {
  let current = solves.map(compactSolve);
  while (true) {
    try {
      writeJson(SOLVES_KEY, current);
      if (current.length < solves.length) {
        console.warn(
          `nact_solves exceeded storage quota — dropped ${solves.length - current.length} oldest solve(s) to free up space.`
        );
      }
      return;
    } catch (err) {
      if (!isQuotaExceededError(err)) throw err;
      if (current.length <= 1) {
        console.error(
          "nact_solves: storage quota exhausted even with only the newest solve kept — this browser's total " +
            "localStorage for this site is full (not just solve history). This solve was not saved; free up " +
            "space via Settings -> Clear all solve history / Reset all algorithm progress."
        );
        return;
      }
      const dropCount = Math.max(1, Math.floor(current.length * 0.1));
      current = current.slice(dropCount);
    }
  }
}

// ─── Solves ───

export function getSolves(): SolveRecord[] {
  const raw = readJson<StoredSolveRecord[]>(SOLVES_KEY, []);
  const hydrated = raw.map(hydrateSolve);
  // Self-heal once: a record saved by an older build still carries the
  // bigger shape on disk — shrink everything to the compact form
  // immediately (via the same writer used for every other mutation)
  // instead of waiting for each solve to be individually re-saved.
  if (raw.some(isLegacyShape)) writeSolvesWithQuotaFallback(hydrated);
  return hydrated;
}

export function getSolvesForSession(sessionId: string): SolveRecord[] {
  return getSolves().filter((s) => s.sessionId === sessionId);
}

export function saveSolve(solve: SolveRecord): void {
  const solves = getSolves();
  solves.push(solve);
  writeSolvesWithQuotaFallback(solves);
}

/** Merge fields into an existing stored solve — used to self-heal legacy records (e.g. backfilling boundary lists added by newer builds, see SolveAnalysis). */
export function patchSolve(id: string, patch: Partial<Omit<SolveRecord, "id">>): void {
  const solves = getSolves();
  const idx = solves.findIndex((s) => s.id === id);
  if (idx >= 0) {
    solves[idx] = { ...solves[idx], ...patch };
    writeSolvesWithQuotaFallback(solves);
  }
}

export function deleteSolve(id: string): void {
  writeSolvesWithQuotaFallback(getSolves().filter((s) => s.id !== id));
}

export function clearSolvesForSession(sessionId: string): void {
  writeSolvesWithQuotaFallback(getSolves().filter((s) => s.sessionId !== sessionId));
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
    moveCountOnly: session.moveCountOnly ?? false,
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
      s.customInspectionSeconds !== raw[i].customInspectionSeconds ||
      s.moveCountOnly !== raw[i].moveCountOnly
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
    moveCountOnly: false,
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
    moveCountOnly: false,
  };
  saveSession(session);
  return session.id;
}
