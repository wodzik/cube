import { describe, expect, it } from "bun:test";
import type { SolveRecord } from "../types/solve";
import { buildShareUrl, decodeSolve, encodeSolve, parseShareHash, shareBlocker } from "./shareLink";
import { collapseIdenticalMoves } from "./moveReduction";

/** Small deterministic PRNG so failures reproduce. */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}
const FACES = ["U", "R", "F", "D", "L", "B"];

function makeRecord(moveCount: number, seed = 1, overrides: Partial<SolveRecord> = {}): SolveRecord {
  const rand = rng(seed);
  let t = 0;
  const moves = Array.from({ length: moveCount }, () => {
    t += rand() < 0.12 ? 800 + rand() * 2400 : -Math.log(1 - rand()) * 220;
    return { move: FACES[Math.floor(rand() * 6)] + (rand() < 0.5 ? "'" : ""), timestamp: 1000 + t, relativeMs: t, phase: "active" as const };
  });
  const scrambleMoves = Array.from({ length: 22 }, () => FACES[Math.floor(rand() * 6)] + ["", "'", "2"][Math.floor(rand() * 3)]);
  const reduced = collapseIdenticalMoves(moves.map((m) => m.move));
  const timeMs = Math.round(t + 500);
  return {
    id: "x", sessionId: "s", method: "CFOP", startMethod: "cube-move", stopMethod: "cube-solved",
    timerStartedAt: 1000, firstMoveAt: 1000, timeToFirstMoveMs: 0, endedAt: 1000 + timeMs, timeMs,
    scramble: scrambleMoves.join(" "), scrambleMoves, moves, reducedMoves: reduced, moveCount: reduced.length,
    tps: reduced.length / (timeMs / 1000), cfop: [], roux: [], lbl: [], isDNF: false, ...overrides,
  };
}

describe("share link codec", () => {
  it("round-trips scramble, every move and its time (to 10 ms), total time and flags", () => {
    for (const [count, seed] of [[1, 1], [2, 2], [60, 3], [100, 4], [333, 5], [1200, 6]] as const) {
      const record = makeRecord(count, seed, { method: (["CFOP", "Roux", "LBL", "unknown"] as const)[seed % 4], isDNF: seed % 2 === 0 });
      const payload = encodeSolve(record, { moveCountOnly: seed % 3 === 0 })!;
      const back = decodeSolve(payload)!;
      expect(back).not.toBeNull();
      expect(back.moveCountOnly).toBe(seed % 3 === 0);
      expect(back.record.method).toBe(record.method);
      expect(back.record.isDNF).toBe(record.isDNF);
      expect(back.record.timeMs).toBe(record.timeMs);
      expect(back.record.scramble).toBe(record.scramble);
      expect(back.record.moves.map((m) => m.move)).toEqual(record.moves.map((m) => m.move));
      for (let i = 0; i < count; i++) {
        expect(Math.abs(back.record.moves[i].relativeMs - record.moves[i].relativeMs)).toBeLessThanOrEqual(5);
        if (i > 0) expect(back.record.moves[i].relativeMs).toBeGreaterThanOrEqual(back.record.moves[i - 1].relativeMs);
      }
    }
  });

  it("derives the fields the preview needs: reduced moves, move count, TPS, first-move time", () => {
    const record = makeRecord(80, 9);
    const back = decodeSolve(encodeSolve(record)!)!.record;
    expect(back.reducedMoves).toEqual(collapseIdenticalMoves(back.moves.map((m) => m.move)));
    expect(back.moveCount).toBe(back.reducedMoves.length);
    expect(back.tps).toBeCloseTo(back.moveCount / (back.timeMs / 1000), 6);
    expect(back.timeToFirstMoveMs).toBe(back.moves[0].relativeMs);
    expect([back.cfop, back.roux, back.lbl]).toEqual([[], [], []]);
    expect(back.id.startsWith("shared-")).toBe(true);
  });

  it("stays compact: a typical solve is a few hundred characters, a 1000-move one still under 2200", () => {
    expect(encodeSolve(makeRecord(60, 1))!.length).toBeLessThan(200);
    expect(encodeSolve(makeRecord(100, 2))!.length).toBeLessThan(300);
    expect(encodeSolve(makeRecord(300, 3))!.length).toBeLessThan(750);
    expect(encodeSolve(makeRecord(1000, 4))!.length).toBeLessThan(2200);
  });

  it("uses only URL-safe characters", () => {
    expect(encodeSolve(makeRecord(400, 7))).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("refuses to encode what it can't represent (double turns in the move log, slice/wide moves, no moves)", () => {
    const base = makeRecord(10, 1);
    expect(shareBlocker(base)).toBeNull();
    expect(encodeSolve({ ...base, moves: [{ ...base.moves[0], move: "R2" }] })).toBeNull();
    expect(encodeSolve({ ...base, moves: [{ ...base.moves[0], move: "M" }] })).toBeNull();
    expect(encodeSolve({ ...base, scramble: "R U x2 F" })).toBeNull();
    expect(shareBlocker({ ...base, moves: [] })).toBe("no-moves");
    expect(buildShareUrl({ ...base, moves: [] })).toBeNull();
  });

  it("rejects garbage, wrong versions, truncation and trailing bytes", () => {
    const valid = encodeSolve(makeRecord(40, 5))!;
    expect(decodeSolve(valid)).not.toBeNull();
    for (const bad of ["", "!!!", "abc def", "A", "AAAA", "////", "not-a-solve"]) expect(decodeSolve(bad)).toBeNull();
    // every strict prefix is cut off somewhere and must not decode
    for (let i = 0; i < valid.length - 1; i++) expect(decodeSolve(valid.slice(0, i))).toBeNull();
    expect(decodeSolve(valid + "AA")).toBeNull(); // trailing bytes
    expect(decodeSolve("Ag" + valid.slice(2))).toBeNull(); // version byte 2
  });

  it("rejects absurd sizes and out-of-range symbols instead of allocating or looping", () => {
    // version 1, flags 0, time 0, scramble length 0, then a move count of 2^35 (six-byte varint)
    const huge = btoa(String.fromCharCode(1, 0, 0, 0, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01)).replace(/=+$/, "");
    expect(decodeSolve(huge)).toBeNull();
    // scramble symbol 31 (> 17): version 1, flags 0, time 0, scramble length 1, symbol 0b11111
    const badSymbol = btoa(String.fromCharCode(1, 0, 0, 1, 31, 1, 0, 0)).replace(/=+$/, "");
    expect(decodeSolve(badSymbol)).toBeNull();
    // move symbol 15 (> 11)
    const badMove = btoa(String.fromCharCode(1, 0, 0, 0, 1, 15, 0)).replace(/=+$/, "");
    expect(decodeSolve(badMove)).toBeNull();
    // time over 24 h
    expect(decodeSolve(btoa(String.fromCharCode(1, 0, 0x80, 0x80, 0x80, 0x80, 0x10, 0)).replace(/=+$/, ""))).toBeNull();
  });

  it("fuzz: random byte strings never throw and never decode to something invalid", () => {
    const rand = rng(42);
    for (let i = 0; i < 2000; i++) {
      const bytes = Array.from({ length: 1 + Math.floor(rand() * 40) }, () => Math.floor(rand() * 256));
      if (rand() < 0.5) bytes[0] = 1;
      const payload = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const decoded = decodeSolve(payload);
      if (decoded) for (const m of decoded.record.moves) expect(m.move).toMatch(/^[URFDLB]'?$/);
    }
  });
});

describe("share URLs", () => {
  it("builds #s=… on the given page and parses it back", () => {
    const record = makeRecord(30, 8);
    const url = buildShareUrl(record, {}, "https://example.com/act/")!;
    expect(url.startsWith("https://example.com/act/#s=")).toBe(true);
    const payload = parseShareHash(url.slice(url.indexOf("#")))!;
    expect(decodeSolve(payload)!.record.scramble).toBe(record.scramble);
  });

  it("only treats #s=<payload> as a share hash", () => {
    expect(parseShareHash("")).toBeNull();
    expect(parseShareHash("#")).toBeNull();
    expect(parseShareHash("#s=")).toBeNull();
    expect(parseShareHash("#other=abc")).toBeNull();
    expect(parseShareHash("#s=abc")).toBe("abc");
  });
});
