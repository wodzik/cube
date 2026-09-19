/**
 * Share links — a finished solve packed into the URL fragment
 * (`…/#s=<payload>`), so anyone can open it in a read-only preview without a
 * backend: the app is static and localStorage-only. The fragment never
 * reaches a server (no request-size limits, nothing in logs).
 *
 * Only what the preview cannot recompute is stored: the scramble, every move
 * with its time, the total time and a few flags. Stage boundaries (cross, F2L,
 * OLL, PLL …) are NOT stored — SolveAnalysis derives them from the scramble
 * and the move log.
 *
 * Payload (version 1), base64url without padding:
 *   byte    version (1)
 *   byte    flags: bit0 DNF · bits1-2 method (0 unknown, 1 CFOP, 2 Roux, 3 LBL) · bit3 moveCountOnly
 *   varint  total time, ms
 *   varint  scramble length, then that many 5-bit symbols (face×3 + [none, ', 2])
 *   varint  move count, then that many 4-bit symbols (face×2 + [none, '])
 *   varint× per move: time since the previous move, in 10 ms units (rounded on
 *           the absolute value, so rounding never accumulates)
 * Varints are unsigned LEB128. A typical 100-move solve is ~245 characters.
 *
 * Decoding is strict: unknown version, truncated or trailing bytes, absurd
 * sizes and bad symbols all return null. The result is display-only data.
 */

import type { MoveRecord } from "../types/session";
import type { SolveMethod, SolveRecord } from "../types/solve";
import { collapseIdenticalMoves } from "./moveReduction";

export const SHARE_VERSION = 1;
export const SHARE_HASH_KEY = "s";
/** Timing resolution of shared moves. */
const TICK_MS = 10;

// Sanity limits for DECODING (an encoded solve of any real length is far below them).
const MAX_SCRAMBLE_MOVES = 300;
const MAX_SOLVE_MOVES = 5000;
const MAX_TIME_MS = 24 * 60 * 60 * 1000;

const FACES = "URFDLB";
const METHODS: SolveMethod[] = ["unknown", "CFOP", "Roux", "LBL"];
const SCRAMBLE_TOKEN = /^([URFDLB])(2|')?$/;
const MOVE_TOKEN = /^([URFDLB])(')?$/;

export interface SharedSolve {
  record: SolveRecord;
  /** The sharer's session hid times (StoredSession.moveCountOnly) — the preview honours that. */
  moveCountOnly: boolean;
}

// ─── varints & bit packing ───

function writeVarint(out: number[], value: number): void {
  let n = Math.max(0, Math.floor(value));
  while (n >= 128) {
    out.push((n % 128) | 128);
    n = Math.floor(n / 128);
  }
  out.push(n);
}

class Reader {
  pos = 0;
  constructor(private readonly bytes: Uint8Array) {}

  byte(): number | null {
    return this.pos < this.bytes.length ? this.bytes[this.pos++] : null;
  }

  varint(): number | null {
    let result = 0;
    let scale = 1;
    for (let i = 0; i < 6; i++) {
      const b = this.byte();
      if (b === null) return null;
      result += (b & 127) * scale;
      if (b < 128) return result;
      scale *= 128;
    }
    return null; // longer than any value we write
  }

  /** `count` values of `width` bits, packed LSB-first; consumes whole bytes. */
  packed(count: number, width: number): number[] | null {
    const needed = Math.ceil((count * width) / 8);
    if (this.pos + needed > this.bytes.length) return null;
    const values: number[] = [];
    let acc = 0;
    let bits = 0;
    let p = this.pos;
    for (let i = 0; i < count; i++) {
      while (bits < width) {
        acc |= this.bytes[p++] << bits;
        bits += 8;
      }
      values.push(acc & ((1 << width) - 1));
      acc >>= width;
      bits -= width;
    }
    this.pos += needed;
    return values;
  }

  get done(): boolean {
    return this.pos === this.bytes.length;
  }
}

function pack(out: number[], values: number[], width: number): void {
  let acc = 0;
  let bits = 0;
  for (const v of values) {
    acc |= v << bits;
    bits += width;
    while (bits >= 8) {
      out.push(acc & 255);
      acc >>= 8;
      bits -= 8;
    }
  }
  if (bits > 0) out.push(acc & 255);
}

function toBase64Url(bytes: number[]): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

// ─── encode ───

/** Why a solve can't be shared, or null if it can. Cheap enough to call while rendering. */
export function shareBlocker(record: SolveRecord): "unsupported-moves" | "no-moves" | null {
  if (record.moves.length === 0) return "no-moves";
  if (record.moves.some((m) => !MOVE_TOKEN.test(m.move))) return "unsupported-moves";
  if (record.scramble.trim().split(/\s+/).filter(Boolean).some((t) => !SCRAMBLE_TOKEN.test(t))) return "unsupported-moves";
  return null;
}

/** The base64url payload for a solve, or null if it can't be shared (see shareBlocker). */
export function encodeSolve(record: SolveRecord, options: { moveCountOnly?: boolean } = {}): string | null {
  if (shareBlocker(record) !== null) return null;

  const scramble = record.scramble.trim().split(/\s+/).filter(Boolean).map((token) => {
    const m = SCRAMBLE_TOKEN.exec(token)!;
    return FACES.indexOf(m[1]) * 3 + (m[2] === undefined ? 0 : m[2] === "'" ? 1 : 2);
  });
  const moves = record.moves.map((m) => {
    const t = MOVE_TOKEN.exec(m.move)!;
    return FACES.indexOf(t[1]) * 2 + (t[2] ? 1 : 0);
  });

  const flags = (record.isDNF ? 1 : 0) | (Math.max(0, METHODS.indexOf(record.method)) << 1) | (options.moveCountOnly ? 8 : 0);
  const out: number[] = [SHARE_VERSION, flags];
  writeVarint(out, record.timeMs);
  writeVarint(out, scramble.length);
  pack(out, scramble, 5);
  writeVarint(out, moves.length);
  pack(out, moves, 4);

  let previousTick = 0;
  for (const m of record.moves) {
    const tick = Math.max(previousTick, Math.round(Math.max(0, m.relativeMs) / TICK_MS));
    writeVarint(out, tick - previousTick);
    previousTick = tick;
  }
  return toBase64Url(out);
}

// ─── decode ───

export function decodeSolve(payload: string): SharedSolve | null {
  const bytes = fromBase64Url(payload);
  if (!bytes) return null;
  const r = new Reader(bytes);

  if (r.byte() !== SHARE_VERSION) return null;
  const flags = r.byte();
  if (flags === null || flags >= 16) return null;
  const timeMs = r.varint();
  if (timeMs === null || timeMs > MAX_TIME_MS) return null;

  const scrambleLength = r.varint();
  if (scrambleLength === null || scrambleLength > MAX_SCRAMBLE_MOVES) return null;
  const scrambleSymbols = r.packed(scrambleLength, 5);
  if (!scrambleSymbols || scrambleSymbols.some((s) => s > 17)) return null;

  const moveCount = r.varint();
  if (moveCount === null || moveCount < 1 || moveCount > MAX_SOLVE_MOVES) return null;
  const moveSymbols = r.packed(moveCount, 4);
  if (!moveSymbols || moveSymbols.some((s) => s > 11)) return null;

  const moves: MoveRecord[] = [];
  let tick = 0;
  for (let i = 0; i < moveCount; i++) {
    const delta = r.varint();
    if (delta === null) return null;
    tick += delta;
    const s = moveSymbols[i];
    const relativeMs = tick * TICK_MS;
    moves.push({ move: FACES[s >> 1] + (s & 1 ? "'" : ""), timestamp: relativeMs, relativeMs, phase: "active" });
  }
  if (!r.done) return null;

  const scrambleMoves = scrambleSymbols.map((s) => FACES[Math.floor(s / 3)] + ["", "'", "2"][s % 3]);
  const reducedMoves = collapseIdenticalMoves(moves.map((m) => m.move));
  const method = METHODS[(flags >> 1) & 3];

  return {
    moveCountOnly: (flags & 8) !== 0,
    record: {
      id: `shared-${payload.slice(0, 12)}`,
      sessionId: "shared",
      method,
      startMethod: "cube-move",
      stopMethod: "cube-solved",
      timerStartedAt: 0,
      firstMoveAt: moves[0].relativeMs,
      timeToFirstMoveMs: moves[0].relativeMs,
      endedAt: timeMs,
      timeMs,
      scramble: scrambleMoves.join(" "),
      scrambleMoves,
      moves,
      reducedMoves,
      moveCount: reducedMoves.length,
      tps: timeMs > 0 ? reducedMoves.length / (timeMs / 1000) : 0,
      cfop: [],
      roux: [],
      lbl: [],
      isDNF: (flags & 1) !== 0,
    },
  };
}

// ─── URLs ───

/** `…#s=<payload>` for the current page, or null if the solve can't be shared. */
export function buildShareUrl(record: SolveRecord, options: { moveCountOnly?: boolean } = {}, base?: string): string | null {
  const payload = encodeSolve(record, options);
  if (payload === null) return null;
  const page = base ?? (typeof location !== "undefined" ? `${location.origin}${location.pathname}` : "");
  return `${page}#${SHARE_HASH_KEY}=${payload}`;
}

/** The payload of a `#s=…` location hash, or null if the hash isn't a share link. */
export function parseShareHash(hash: string): string | null {
  const m = new RegExp(`^#${SHARE_HASH_KEY}=(.+)$`).exec(hash);
  return m ? m[1] : null;
}
