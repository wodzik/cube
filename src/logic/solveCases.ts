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
 * F2L: one of the 41 cases; with a piece of the pair stuck in another slot,
 * one of the Advanced F2L set's (recognised from its own algorithms); else
 * the case the pair became once the piece was out ("after" n moves).
 *
 * How each case was DONE: the stage's moves (as the cube was held, cross
 * down) matched by effect (cubecore AlgMatcher — any notation, slips and
 * slice halves in any order) against the case's algorithms, the ones you
 * added included; the longest ending that is one of them, the moves before
 * it a setup. None matching: done your own way (intuitive, or an algorithm
 * not in the set).
 *
 * Results are cached per solve id (a solve never changes its moves).
 */

import { type Face, FRAMES, type Frame, type Move, type State, applyMove, applyMoves, checks, invert, parseAlg, solvedState, view } from "@wodzik/cubecore/core";
import { AlgMatcher } from "@wodzik/cubecore/core";
import { F2LCaseTable, type F2LSlot, isTrappedF2L, recognizeF2L, recognizeOll, recognizePll } from "@wodzik/cubecore/cfop";
import advancedF2lJson from "../algs/advanced-f2l.json";
import { loadAlgGroup } from "../services/algorithmStore";
import { getSubgroupCases } from "../services/algGroupRegistry";
import type { AlgorithmCase } from "../types/algorithm";
import { recognizeCmllAnywhere, secondBlock } from "@wodzik/cubecore/roux";
import type { SolveRecord } from "../types/solve";
import { frameForBottom } from "./trainerCatalog";
import type { StageBoundary } from "./stageDetection/types";

export type CaseKind = "f2l" | "af2l" | "oll" | "pll" | "cmll";

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
  /** Advanced F2L: the set's subgroup the case is from (where the piece was stuck). */
  subgroup?: string;
  /** F2L: the case came up only after this many moves (a piece taken out of another slot first). */
  after?: number;
  /** How it was done — the case's algorithm its moves matched (see the file's comment); null: none of them. Unset: not checked. */
  done?: CaseExecution | null;
}

export interface CaseExecution {
  variantId: string;
  /** Its place in the case's list — the same algorithm in every slot's F2L set. */
  variantIndex: number;
  variantName: string;
  alg: string;
  /** Moves before the algorithm (a setup, an extraction, an AUF split off…). */
  setup: number;
}

export const CASE_KIND_LABEL: Record<CaseKind, string> = { f2l: "F2L", af2l: "Advanced F2L", oll: "OLL", pll: "PLL", cmll: "CMLL" };

/** F2L / Advanced F2L sets' subgroup per slot (canonical, cross on D). */
export const SLOT_SUBGROUP: Record<F2LSlot, string> = { FR: "front-right", FL: "front-left", BL: "back-left", BR: "back-right" };

/** Where a case's algorithms live; F2L / Advanced F2L cases are the same in every slot's set — `subgroup` picks one (default the front-right set). */
export function caseLocation(kind: CaseKind, subgroup?: string): CaseLocation {
  if (kind === "f2l") return { group: "f2l", subgroup: subgroup ?? "front-right" };
  if (kind === "af2l") return { group: "advanced-f2l", subgroup: subgroup ?? "front-right" };
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

/** One frame per bottom face — the one the Steps trainers use (frameForBottom), so a slot here is the same slot there. */
const FRAME_BY_BOTTOM = new Map<Face, Frame>((["U", "R", "F", "D", "L", "B"] as Face[]).map((d) => [d, frameForBottom(d)]));

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
    out[`f2l-${n}`] = slot ? f2lCase(record, frame, before, slot, doneAt(prev), doneAt(cur)) : { kind: "f2l", name: "other" };
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
  // How each case was done: its stage's moves against the case's algorithms.
  const range = (stage: string, prevStage: string) => {
    const b = byStage.get(stage);
    const p = byStage.get(prevStage);
    return b && p ? ([doneAt(p), doneAt(b)] as const) : null;
  };
  const previous: Record<string, string> = { "f2l-1": "cross", "f2l-2": "f2l-1", "f2l-3": "f2l-2", "f2l-4": "f2l-3", oll: "f2l-4", pll: "oll" };
  for (const [stage, c] of Object.entries(out)) {
    if (!isRealCase(c)) continue;
    const r = range(stage, previous[stage]);
    if (r && r[1] > r[0]) c.done = execution(record, frame, c, r[0], r[1]);
  }
  return out;
}

// ─── F2L beyond the 41: Advanced F2L, or the case after an extraction ───

/** Advanced F2L recognition per target slot, from the set's own algorithms (its subgroups are where the piece is stuck; the pair it's for is the target). */
let advanced: Map<F2LSlot, F2LCaseTable> | null = null;
function advancedTables(): Map<F2LSlot, F2LCaseTable> {
  if (advanced) return advanced;
  const slots: F2LSlot[] = ["FR", "FL", "BL", "BR"];
  const bySlot = new Map<F2LSlot, { id: string; alg: string }[]>(slots.map((s) => [s, []]));
  for (const sg of (advancedF2lJson as { subgroups: { id: string; cases: { name: string; algList: { alg: string; isDefault?: boolean }[] }[] }[] }).subgroups) {
    for (const c of sg.cases) {
      const alg = (c.algList.find((v) => v.isDefault) ?? c.algList[0])?.alg.replace(/[()]/g, " ");
      if (!alg) continue;
      let s: State;
      try {
        s = applyMoves(solvedState(), invert(parseAlg(alg)));
      } catch {
        continue;
      }
      // The pair the algorithm is for: the one with a piece stuck elsewhere (a case with both pairs stuck is left out).
      const targets = slots.filter((x) => isTrappedF2L(s, x));
      if (targets.length === 1) bySlot.get(targets[0])!.push({ id: `${sg.id}|${c.name}`, alg });
    }
  }
  advanced = new Map(slots.map((slot) => [slot, new F2LCaseTable(slot, bySlot.get(slot)!)]));
  return advanced;
}

function f2lCase(record: SolveRecord, frame: Frame, before: State, slot: F2LSlot, from: number, to: number): StageCase {
  const match = recognizeF2L(before, slot);
  if (match && match !== "solved") return { kind: "f2l", name: match.id, preAuf: match.preAuf, slot };
  if (!isTrappedF2L(before, slot)) return { kind: "f2l", name: "other", slot };
  const adv = advancedTables().get(slot)?.recognize(before);
  if (adv) {
    const [subgroup, name] = adv.id.split("|");
    return { kind: "af2l", name, subgroup, preAuf: adv.preAuf, slot };
  }
  // Not in the set: the case the pair became once the stuck piece was out.
  const counts = Array.from({ length: to - from + 1 }, (_, k) => from + k);
  const states = statesAt(record, counts);
  for (const c of counts) {
    const s = states.get(c);
    if (!s) break;
    const v = view(s, frame);
    if (isTrappedF2L(v, slot)) continue;
    const m = recognizeF2L(v, slot);
    if (m && m !== "solved") return { kind: "f2l", name: m.id, preAuf: m.preAuf, slot, after: c - from };
    break;
  }
  return { kind: "f2l", name: "other", slot };
}

// ─── how a case was done ───

/** The algorithms a case has in its set (yours included). */
function algorithmsOf(c: StageCase): AlgorithmCase | undefined {
  const { group, subgroup } = caseLocation(c.kind, c.kind === "f2l" && c.slot ? SLOT_SUBGROUP[c.slot] : c.subgroup);
  const cases = subgroup ? getSubgroupCases(group, subgroup) : loadAlgGroup(group);
  return cases.find((x) => x.name === c.name);
}

/** A face as the cube was held in `frame` (canonical letter for a physical face). */
const heldLetter = (frame: Frame, move: string) => {
  const canonical = (Object.keys(frame.face) as Face[]).find((f) => frame.face[f] === move[0]);
  return canonical ? canonical + move.slice(1) : move;
};

function execution(record: SolveRecord, frame: Frame, c: StageCase, from: number, to: number): CaseExecution | null {
  const kase = algorithmsOf(c);
  if (!kase) return null;
  const matcher = new AlgMatcher<{ id: string; index: number; name: string; alg: string }>();
  kase.algList.forEach((v, index) => matcher.add(v.alg, { id: v.id, index, name: v.name, alg: v.alg }));
  const moves = record.moves.slice(from, to).map((m) => heldLetter(frame, m.move));
  let found: ReturnType<typeof matcher.matchSuffix> = null;
  try {
    found = matcher.matchSuffix(moves.join(" "));
  } catch {
    return null;
  }
  return found ? { variantId: found.data.id, variantIndex: found.data.index, variantName: found.data.name, alg: found.data.alg, setup: found.start } : null;
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
  const bs = boundaries ?? (method === "CFOP" ? record.cfop : record.roux) ?? [];
  // Keyed by the boundaries actually used: a stored solve recomputed (healed) gets new ones.
  const key = `${record.id}|${method}|${bs.map((b) => b.moveIndex).join(",")}`;
  let hit = cache.get(key);
  if (!hit) {
    try {
      hit = method === "CFOP" ? cfopCases(record, bs) : rouxCases(record, bs);
    } catch {
      hit = {};
    }
    cache.set(key, hit);
  }
  return hit;
}

/**
 * A CFOP solve's cross as a case: the scrambled cube and the face the cross
 * was built on — for its optimal length, and to practise it in the cross
 * trainer. Null when there's no cross stage (or it was done before the
 * first move).
 */
export function crossCaseOf(record: SolveRecord, boundaries: readonly StageBoundary[] = record.cfop ?? []): { start: State; face: Face } | null {
  const cross = boundaries.find((b) => b.stage === "cross");
  if (!cross || cross.moveIndex < 0) return null;
  const states = statesAt(record, [0, doneAt(cross)]);
  const start = states.get(0);
  const done = states.get(doneAt(cross));
  const frame = done && crossFrame(done, cross.detail);
  return start && frame ? { start, face: frame.face.D } : null;
}

/**
 * The cube as a stage of a CFOP solve began (the state its case is in) and
 * the cross face — to practise that case in Steps.
 */
export function stageStartOf(record: SolveRecord, stage: string, boundaries: readonly StageBoundary[] = record.cfop ?? []): { start: State; face: Face } | null {
  const order = ["cross", "f2l-1", "f2l-2", "f2l-3", "f2l-4", "oll", "pll", "auf"];
  const i = order.indexOf(stage);
  const cross = boundaries.find((b) => b.stage === "cross");
  const prev = i > 0 ? boundaries.find((b) => b.stage === order[i - 1]) : undefined;
  if (!cross || (i > 0 && !prev)) return null;
  const at = prev ? doneAt(prev) : 0;
  const states = statesAt(record, [at, doneAt(cross)]);
  const start = states.get(at);
  const done = states.get(doneAt(cross));
  const frame = done && crossFrame(done, cross.detail);
  return start && frame ? { start, face: frame.face.D } : null;
}
