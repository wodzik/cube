/**
 * Which algorithm case each stage of a solve started from — the stages we
 * have algorithm sets for: CFOP's F2L pairs, OLL and PLL; Roux's CMLL.
 *
 * The solve is replayed with cubecore (scramble, then the raw move log) and
 * each stage's START state (where the previous stage ended, per the record's
 * stage boundaries) is recognised with cubecore's case recognisers. Names
 * match the Drill Algorithms groups' case names ("F2L 5", "OLL 27", "T",
 * "Sune Left Bar"), so a case links straight to its algorithms.
 *
 * Results are cached per solve id (a solve never changes its moves).
 */

import { type Face, FRAMES, type Frame, type Move, type State, applyMove, applyMoves, checks, parseAlg, solvedState, view } from "@wodzik/cubecore/core";
import { type F2LSlot, recognizeF2L, recognizeOll, recognizePll } from "@wodzik/cubecore/cfop";
import { recognizeCmllAnywhere, secondBlock } from "@wodzik/cubecore/roux";
import type { SolveRecord } from "../types/solve";
import type { StageBoundary } from "./stageDetection/types";

export type CaseKind = "f2l" | "oll" | "pll" | "cmll";

/** Where a case's algorithms live in Drill Algorithms. */
export interface CaseLocation {
  group: string;
  /** F2L cases open in the front-right set (every slot has the same 41 cases). */
  subgroup?: string;
}

export interface StageCase {
  kind: CaseKind;
  /** The case name ("F2L 5", "OLL 27", "T", "Sune Left Bar"); "skip" when the stage had nothing to do; "other" when it isn't one of the set's cases (e.g. an F2L pair with a piece in another slot). */
  name: string;
  /** The U turn before the algorithm, as the cube was held. */
  preAuf?: string;
  /** F2L: the slot the pair went into (canonical, cross on D). */
  slot?: F2LSlot;
}

export const CASE_KIND_LABEL: Record<CaseKind, string> = { f2l: "F2L", oll: "OLL", pll: "PLL", cmll: "CMLL" };

export function caseLocation(kind: CaseKind): CaseLocation {
  if (kind === "f2l") return { group: "f2l", subgroup: "front-right" };
  return { group: kind };
}

/** A real case (not a skip / non-standard one) — something with algorithms to show. */
export const isRealCase = (c: StageCase | undefined): c is StageCase => !!c && c.name !== "skip" && c.name !== "other";

/** "OLL 27" / "PLL T" / "F2L 5" / "CMLL Sune Left Bar" — the name prefixed by its set where the name alone doesn't say it. */
export function caseTitle(c: Pick<StageCase, "kind" | "name">): string {
  if (c.name === "skip") return `${CASE_KIND_LABEL[c.kind]} skip`;
  if (c.name === "other") return `${CASE_KIND_LABEL[c.kind]}: not a standard case`;
  return c.kind === "pll" || c.kind === "cmll" ? `${CASE_KIND_LABEL[c.kind]} ${c.name}` : c.name;
}

// ─── replay ───

const parsed = new Map<string, Move | null>();
function moveOf(text: string): Move | null {
  let m = parsed.get(text);
  if (m === undefined) {
    try {
      m = parseAlg(text)[0] ?? null;
    } catch {
      m = null;
    }
    parsed.set(text, m);
  }
  return m;
}

/** The state after each requested number of raw moves (0 = the scrambled cube). */
function statesAt(record: SolveRecord, counts: readonly number[]): Map<number, State> {
  const wanted = new Set(counts);
  const out = new Map<number, State>();
  let s: State;
  try {
    s = applyMoves(solvedState(), record.scramble);
  } catch {
    return out;
  }
  if (wanted.has(0)) out.set(0, s);
  const last = Math.max(0, ...counts);
  for (let i = 0; i < Math.min(last, record.moves.length); i++) {
    const m = moveOf(record.moves[i].move);
    if (m) s = applyMove(s, m);
    if (wanted.has(i + 1)) out.set(i + 1, s);
  }
  return out;
}

/** Moves done when a boundary was reached (its move included; -1 = before the first move). */
const doneAt = (b: StageBoundary) => b.moveIndex + 1;

/** One frame per bottom face (which one of the four around it doesn't matter: F2L case names are the same in every slot). */
const FRAME_BY_BOTTOM = new Map<Face, Frame>();
for (const f of FRAMES) if (!FRAME_BY_BOTTOM.has(f.face.D)) FRAME_BY_BOTTOM.set(f.face.D, f);

/** A frame with the cross face down: the boundary's detail (the cross face) if its cross is solved, else any face whose cross is. */
function crossFrame(state: State, detail: string | undefined): Frame | null {
  const named = detail ? FRAME_BY_BOTTOM.get(detail as Face) : undefined;
  if (named && checks.crossSolved(view(state, named))) return named;
  for (const f of FRAME_BY_BOTTOM.values()) if (checks.crossSolved(view(state, f))) return f;
  return null;
}

function cfopCases(record: SolveRecord, boundaries: readonly StageBoundary[]): Record<string, StageCase> {
  const cross = boundaries.find((b) => b.stage === "cross");
  if (!cross) return {};
  const byStage = new Map(boundaries.map((b) => [b.stage, b]));
  const order = ["cross", "f2l-1", "f2l-2", "f2l-3", "f2l-4", "oll", "pll"];
  const counts = order.map((st) => byStage.get(st)).filter((b): b is StageBoundary => !!b).map(doneAt);
  const states = statesAt(record, counts);
  const crossState = states.get(doneAt(cross));
  const frame = crossState && crossFrame(crossState, cross.detail);
  if (!frame) return {};
  const canonical = (b: StageBoundary | undefined) => {
    const s = b && states.get(doneAt(b));
    return s ? view(s, frame) : null;
  };

  const out: Record<string, StageCase> = {};
  const assigned = new Set<string>();
  for (let n = 1; n <= 4; n++) {
    const prev = byStage.get(n === 1 ? "cross" : `f2l-${n - 1}`);
    const cur = byStage.get(`f2l-${n}`);
    const before = canonical(prev);
    const after = canonical(cur);
    if (!prev || !cur || !before || !after) break;
    if (cur.moveIndex < 0) continue; // already done before the first move (a partial-start session): no case, no skip
    const had = new Set(checks.solvedPairs(before));
    const slot = checks.solvedPairs(after).find((p) => !had.has(p) && !assigned.has(p)) as F2LSlot | undefined;
    if (slot) assigned.add(slot);
    if (cur.moveIndex === prev.moveIndex) {
      out[`f2l-${n}`] = { kind: "f2l", name: "skip", slot };
      continue;
    }
    const match = slot ? recognizeF2L(before, slot) : null;
    out[`f2l-${n}`] = match && match !== "solved" ? { kind: "f2l", name: match.id, preAuf: match.preAuf, slot } : { kind: "f2l", name: "other", slot };
  }

  const done = (st: string) => (byStage.get(st)?.moveIndex ?? -1) >= 0;
  const ollStart = canonical(byStage.get("f2l-4"));
  if (ollStart && done("oll")) {
    try {
      const m = recognizeOll(ollStart);
      out.oll = m ? { kind: "oll", name: m.id, preAuf: m.preAuf } : { kind: "oll", name: "skip" };
    } catch {
      // not a last-layer state (F2L detection disagreed) — no case
    }
  }
  const pllStart = canonical(byStage.get("oll"));
  if (pllStart && done("pll")) {
    try {
      const m = recognizePll(pllStart);
      out.pll = m ? { kind: "pll", name: m.id, preAuf: m.preAuf } : { kind: "pll", name: "skip" };
    } catch {
      // not an oriented last layer
    }
  }
  return out;
}

function rouxCases(record: SolveRecord, boundaries: readonly StageBoundary[]): Record<string, StageCase> {
  const sb = boundaries.find((b) => b.stage === "sb");
  if (!sb || !boundaries.some((b) => b.stage === "cmll" && b.moveIndex >= 0)) return {};
  const s = statesAt(record, [doneAt(sb)]).get(doneAt(sb));
  const found = s ? recognizeCmllAnywhere(s, secondBlock) : null;
  if (!found) return {};
  return { cmll: found.match === "skip" ? { kind: "cmll", name: "skip" } : { kind: "cmll", name: found.match.id, preAuf: found.match.preAuf } };
}

// ─── public ───

const cache = new Map<string, Record<string, StageCase>>();

/**
 * Stage id → the case it started from, for the method whose boundaries
 * these are ("CFOP" or "Roux"; other methods have no algorithm stages).
 * `boundaries` default to the record's own.
 */
export function solveCases(record: SolveRecord, method: string, boundaries?: readonly StageBoundary[]): Record<string, StageCase> {
  if (method !== "CFOP" && method !== "Roux") return {};
  const key = `${record.id}|${method}|${boundaries ? boundaries.map((b) => b.moveIndex).join(",") : ""}`;
  let hit = cache.get(key);
  if (!hit) {
    try {
      hit = method === "CFOP" ? cfopCases(record, boundaries ?? record.cfop ?? []) : rouxCases(record, boundaries ?? record.roux ?? []);
    } catch {
      hit = {};
    }
    cache.set(key, hit);
  }
  return hit;
}
