/**
 * Per-case statistics — from solves (how often a case came up and how fast
 * it was solved in them, see solveCases.ts) and from Drill Algorithms (each
 * algorithm's attempts for the case).
 */

import type { SolveRecord } from "../types/solve";
import type { AlgorithmCase, AlgorithmVariant } from "../types/algorithm";
import { METHOD_DETECTORS } from "./stageDetection/methodRegistry";
import { computeStageTimings } from "./stageDetection/stageTiming";
import { type CaseKind, type StageCase, caseLocation, isRealCase, solveCases } from "./solveCases";
import { computeVariantStatsForSource, formatTime } from "./statistics";
import { loadAlgGroup } from "../services/algorithmStore";
import { getSubgroupCases } from "../services/algGroupRegistry";

// ─── from solves ───

export interface CaseSeen {
  solveId: string;
  /** When the solve ended (epoch ms). */
  at: number;
  stage: string;
  /** Recognition + execution of the stage, ms. */
  totalMs: number;
  recognitionMs: number;
  executionMs: number;
  moves: number;
}

export interface CaseSolveStats {
  kind: CaseKind;
  name: string;
  seen: CaseSeen[];
  count: number;
  meanMs: number;
  bestMs: number;
  meanRecognitionMs: number;
  meanExecutionMs: number;
  meanMoves: number;
  lastAt: number;
}

export const caseKey = (c: Pick<StageCase, "kind" | "name">) => `${c.kind}:${c.name}`;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Every real case in these solves (their own method: CFOP → F2L / OLL / PLL, Roux → CMLL), with how it went each time. Also counts skips per kind. */
export function collectCaseStats(solves: readonly SolveRecord[]): { cases: Map<string, CaseSolveStats>; skips: Record<CaseKind, number>; solves: number } {
  const seen = new Map<string, { kind: CaseKind; name: string; seen: CaseSeen[] }>();
  const skips: Record<CaseKind, number> = { f2l: 0, oll: 0, pll: 0, cmll: 0 };
  let counted = 0;
  for (const record of solves) {
    if (record.method !== "CFOP" && record.method !== "Roux") continue;
    const boundaries = record.method === "CFOP" ? record.cfop : record.roux;
    if (!boundaries?.length) continue;
    const cases = solveCases(record, record.method);
    const entries = Object.entries(cases);
    if (!entries.length) continue;
    counted++;
    const timings = computeStageTimings(METHOD_DETECTORS[record.method].stages, boundaries, record.moves);
    for (const [stage, c] of entries) {
      if (c.name === "skip") skips[c.kind]++;
      if (!isRealCase(c)) continue;
      const t = timings.find((x) => x.stage === stage);
      if (!t || t.moveCount === 0) continue;
      const key = caseKey(c);
      let entry = seen.get(key);
      if (!entry) seen.set(key, (entry = { kind: c.kind, name: c.name, seen: [] }));
      entry.seen.push({ solveId: record.id, at: record.endedAt, stage, totalMs: t.totalMs, recognitionMs: t.recognitionMs, executionMs: t.executionMs, moves: t.moveCount });
    }
  }
  const out = new Map<string, CaseSolveStats>();
  for (const [key, e] of seen) {
    out.set(key, {
      ...e,
      count: e.seen.length,
      meanMs: avg(e.seen.map((s) => s.totalMs)),
      bestMs: Math.min(...e.seen.map((s) => s.totalMs)),
      meanRecognitionMs: avg(e.seen.map((s) => s.recognitionMs)),
      meanExecutionMs: avg(e.seen.map((s) => s.executionMs)),
      meanMoves: avg(e.seen.map((s) => s.moves)),
      lastAt: Math.max(...e.seen.map((s) => s.at)),
    });
  }
  return { cases: out, skips, solves: counted };
}

// ─── from Drill Algorithms ───

/** The case as stored in Drill Algorithms (its algorithms and their attempts), or undefined if that set has no such case. */
export function drillCase(kind: CaseKind, name: string): AlgorithmCase | undefined {
  const { group, subgroup } = caseLocation(kind);
  const cases = subgroup ? getSubgroupCases(group, subgroup) : loadAlgGroup(group);
  return cases.find((c) => c.name === name);
}

export interface VariantStats {
  variant: AlgorithmVariant;
  count: number;
  /** Seconds. */
  best: number | null;
  mean: number | null;
  ao5: number | null;
  ao12: number | null;
  /** The average the "most consistent" pick compares: ao12, else ao5, else the mean of at least 3. */
  average: number | null;
}

/** Each algorithm's drill stats for a case, plus which is fastest (best single) and which has the best average. */
export function variantStats(c: AlgorithmCase): { rows: VariantStats[]; fastest: string | null; mostConsistent: string | null } {
  const rows = c.algList.map((variant) => {
    const s = computeVariantStatsForSource(variant.times, "training");
    const average = s.ao12 ?? s.ao5 ?? (s.count >= 3 ? s.mean : null);
    return { variant, count: s.count, best: s.bestTime, mean: s.mean, ao5: s.ao5, ao12: s.ao12, average };
  });
  const pick = (value: (r: VariantStats) => number | null) => {
    let best: VariantStats | null = null;
    for (const r of rows) {
      const v = value(r);
      if (v !== null && (best === null || v < value(best)!)) best = r;
    }
    return best?.variant.id ?? null;
  };
  return { rows, fastest: pick((r) => r.best), mostConsistent: pick((r) => r.average) };
}

/** The best single drill time over all of a case's algorithms (seconds), for a summary column. */
export function drillBest(c: AlgorithmCase | undefined): number | null {
  if (!c) return null;
  const bests = variantStats(c).rows.map((r) => r.best).filter((b): b is number => b !== null);
  return bests.length ? Math.min(...bests) : null;
}

export const fmtSec = (s: number | null) => (s === null ? "—" : formatTime(s));
export const fmtMs = (ms: number) => `${(ms / 1000).toFixed(2)}`;
