/**
 * Case stats — every F2L / OLL / PLL / CMLL case that came up in your solves
 * (CFOP solves: F2L pairs, OLL, PLL; Roux solves: CMLL): how often, how
 * fast (recognition + execution), how many moves, and your best drill time
 * for it. A row opens the case: its algorithms with their drill stats, and
 * a Drill button (CaseAlgorithmsModal).
 */

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { getSolves } from "../services/solveStore";
import { getGroupMeta, getSubgroupCases, resolveDisplayConfig, resolveStickeringProps } from "../services/algGroupRegistry";
import { loadAlgGroup } from "../services/algorithmStore";
import { getDefaultVariant } from "../logic/algGroupConfig";
import { type CaseKind, CASE_KIND_LABEL, caseLocation, caseTitle } from "../logic/solveCases";
import { type CaseSolveStats, caseKey, collectCaseStats, drillBest, fmtMs, fmtSec } from "../logic/caseStats";
import { formatRelativeTime } from "../logic/statistics";
import { AlgCaseVisualisation } from "../components/AlgCaseVisualisation";
import { CaseAlgorithmsModal } from "../components/CaseAlgorithmsModal";
import type { AlgorithmCase } from "../types/algorithm";

const KINDS: CaseKind[] = ["f2l", "oll", "pll", "cmll"];

type Sort = "seen" | "slowest" | "fastest" | "recognition" | "recent" | "name";
const SORTS: [Sort, string][] = [
  ["seen", "Most seen"],
  ["slowest", "Slowest average"],
  ["fastest", "Fastest average"],
  ["recognition", "Longest recognition"],
  ["recent", "Recently seen"],
  ["name", "Case"],
];

interface Row {
  name: string;
  kase?: AlgorithmCase;
  stats: CaseSolveStats | null;
  drillBest: number | null;
}

function casesOfSet(kind: CaseKind): AlgorithmCase[] {
  const { group, subgroup } = caseLocation(kind);
  return subgroup ? getSubgroupCases(group, subgroup) : loadAlgGroup(group);
}

/** "OLL 9" < "OLL 10": numbers compared as numbers. */
const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

function sortRows(rows: Row[], sort: Sort): Row[] {
  const seen = (r: Row) => r.stats?.count ?? 0;
  const mean = (r: Row) => r.stats?.meanMs ?? null;
  const cmp: Record<Sort, (a: Row, b: Row) => number> = {
    seen: (a, b) => seen(b) - seen(a) || byName(a.name, b.name),
    slowest: (a, b) => (mean(b) ?? -1) - (mean(a) ?? -1) || byName(a.name, b.name),
    fastest: (a, b) => (mean(a) ?? Infinity) - (mean(b) ?? Infinity) || byName(a.name, b.name),
    recognition: (a, b) => (b.stats?.meanRecognitionMs ?? -1) - (a.stats?.meanRecognitionMs ?? -1) || byName(a.name, b.name),
    recent: (a, b) => (b.stats?.lastAt ?? 0) - (a.stats?.lastAt ?? 0) || byName(a.name, b.name),
    name: (a, b) => byName(a.name, b.name),
  };
  return [...rows].sort(cmp[sort]);
}

function CasePicture({ kind, kase }: { kind: CaseKind; kase?: AlgorithmCase }) {
  const alg = kase ? (getDefaultVariant(kase)?.alg ?? "").replace(/[()]/g, "").replace(/\s+/g, " ").trim() : "";
  if (!alg) return <div className="size-12 shrink-0" />;
  const { group, subgroup } = caseLocation(kind);
  const meta = getGroupMeta(group);
  const display = resolveDisplayConfig(meta, subgroup ? meta?.subgroups?.find((s) => s.id === subgroup)?.displayConfig : undefined, kase?.displayConfigOverride);
  return (
    <div className="size-12 shrink-0">
      <AlgCaseVisualisation
        alg={alg}
        visualization={display.cardVisualization}
        cameraLatitude={display.cameraLatitude}
        cameraLongitude={display.cameraLongitude}
        {...resolveStickeringProps(display.stickering)}
        className="size-full"
      />
    </div>
  );
}

export default function CaseStatsPage() {
  const all = useMemo(() => collectCaseStats(getSolves()), []);
  const [kind, setKind] = useState<CaseKind>(() => (all.cases.size && ![...all.cases.values()].some((c) => c.kind === "f2l") && [...all.cases.values()].some((c) => c.kind === "cmll") ? "cmll" : "f2l"));
  const [sort, setSort] = useState<Sort>("seen");
  const [showUnseen, setShowUnseen] = useState(false);
  const [open, setOpen] = useState<Row | null>(null);

  const counts = useMemo(() => {
    const out: Record<CaseKind, number> = { f2l: 0, oll: 0, pll: 0, cmll: 0 };
    for (const c of all.cases.values()) out[c.kind] += c.count;
    return out;
  }, [all]);

  const rows = useMemo(() => {
    const set = casesOfSet(kind);
    const byName = new Map(set.map((c) => [c.name, c]));
    const seen: Row[] = [...all.cases.values()].filter((c) => c.kind === kind).map((c) => ({ name: c.name, kase: byName.get(c.name), stats: c, drillBest: drillBest(byName.get(c.name)) }));
    const unseen: Row[] = showUnseen ? set.filter((c) => !all.cases.has(caseKey({ kind, name: c.name }))).map((c) => ({ name: c.name, kase: c, stats: null, drillBest: drillBest(c) })) : [];
    return sortRows([...seen, ...unseen], sort);
  }, [all, kind, sort, showUnseen]);

  const total = counts[kind] + all.skips[kind];

  return (
    <main className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${kind === k ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"}`}
            >
              {CASE_KIND_LABEL[k]} <span className="text-gray-500 font-mono">{counts[k]}</span>
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="bg-gray-950/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[var(--accent)]"
        >
          {SORTS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
          <input type="checkbox" checked={showUnseen} onChange={(e) => setShowUnseen(e.target.checked)} />
          Cases not seen yet
        </label>
        <span className="text-[11px] text-gray-500 ml-auto">
          {all.solves} solves · {kind === "cmll" ? "Roux" : "CFOP"}
          {all.skips[kind] > 0 && total > 0 && (
            <>
              {" · "}
              {kind === "f2l" ? "two pairs at once" : `${CASE_KIND_LABEL[kind]} skip`} {all.skips[kind]}× ({Math.round((all.skips[kind] / total) * 100)}%)
            </>
          )}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-gray-500">
          <BarChart3 size={28} />
          <p className="text-sm">
            No {CASE_KIND_LABEL[kind]} cases in your solves yet — they're recognised in {kind === "cmll" ? "Roux" : "CFOP"} solves on the Solve tab.
          </p>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-gray-500 text-right">
                <th className="text-left font-semibold px-3 py-2" colSpan={2}>
                  Case
                </th>
                <th className="font-semibold px-2 py-2">Seen</th>
                <th className="font-semibold px-2 py-2" title="Recognition + execution, average">
                  Average
                </th>
                <th className="font-semibold px-2 py-2">Best</th>
                <th className="font-semibold px-2 py-2" title="Average pause before the first move">
                  Recog.
                </th>
                <th className="font-semibold px-2 py-2" title="Average time turning">
                  Exec.
                </th>
                <th className="font-semibold px-2 py-2">Moves</th>
                <th className="font-semibold px-2 py-2" title="Your best single in Drill Algorithms (any of the case's algorithms)">
                  Drill best
                </th>
                <th className="font-semibold px-3 py-2">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.name}
                  onClick={() => setOpen(r)}
                  className="border-t border-white/[0.05] hover:bg-white/[0.04] cursor-pointer text-right font-mono tabular-nums text-gray-300"
                  title="Algorithms and drill stats for this case"
                >
                  <td className="pl-3 py-1.5 w-14">
                    <CasePicture kind={kind} kase={r.kase} />
                  </td>
                  <td className="text-left px-2 py-1.5 font-sans">
                    <div className="text-sm font-semibold text-gray-100">{caseTitle({ kind, name: r.name })}</div>
                    {r.kase?.category && <div className="text-[10px] text-gray-500">{r.kase.category}</div>}
                  </td>
                  <td className="px-2">{r.stats ? `${r.stats.count}×` : "—"}</td>
                  <td className="px-2 text-gray-100 font-semibold">{r.stats ? fmtMs(r.stats.meanMs) : "—"}</td>
                  <td className="px-2">{r.stats ? fmtMs(r.stats.bestMs) : "—"}</td>
                  <td className="px-2">{r.stats ? fmtMs(r.stats.meanRecognitionMs) : "—"}</td>
                  <td className="px-2">{r.stats ? fmtMs(r.stats.meanExecutionMs) : "—"}</td>
                  <td className="px-2">{r.stats ? r.stats.meanMoves.toFixed(1) : "—"}</td>
                  <td className="px-2">{fmtSec(r.drillBest)}</td>
                  <td className="px-3 font-sans text-gray-500">{r.stats ? formatRelativeTime(r.stats.lastAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <CaseAlgorithmsModal kind={kind} name={open.name} solveStats={open.stats} onClose={() => setOpen(null)} />}
    </main>
  );
}
