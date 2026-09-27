/**
 * Case stats — F2L / OLL / PLL / CMLL, per case, from three places:
 *   Solves     — the cases that came up in your solves (CFOP: F2L pairs,
 *                OLL, PLL; Roux: CMLL) and how they went (logic/solveCases);
 *   Drill      — Drill Algorithms: your attempts at each case's algorithms;
 *   Recognize  — the case trainers' Recognize mode (the case on the screen):
 *                time to the first turn, and to solved.
 * A row opens the case: its algorithms with their drill stats and a Drill
 * button (CaseAlgorithmsModal).
 */

import { openTab } from "../services/tabNav";
import { PageLabel } from "../components/PageLabel";
import { type ReactNode, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { getSolves } from "../services/solveStore";
import { getTrainerAttempts } from "../services/trainerStore";
import { getGroupMeta, getSubgroupCases, resolveDisplayConfig, resolveStickeringProps } from "../services/algGroupRegistry";
import { loadAlgGroup } from "../services/algorithmStore";
import { getDefaultVariant } from "../logic/algGroupConfig";
import { type CaseKind, CASE_KIND_LABEL, caseLocation, caseTitle } from "../logic/solveCases";
import { caseKey, collectCaseStats, drillBest, drillStats, fmtMs, fmtSec, recognizeStats } from "../logic/caseStats";
import { formatRelativeTime } from "../logic/statistics";
import { AlgCaseVisualisation } from "../components/AlgCaseVisualisation";
import { CaseAlgorithmsModal } from "../components/CaseAlgorithmsModal";
import type { AlgorithmCase } from "../types/algorithm";

const KINDS: CaseKind[] = ["f2l", "oll", "pll", "cmll"];

/** Where each source's data comes from — the empty state links there. */
const EMPTY_LINK: Record<"solves" | "drill" | "recognize", [string, string]> = {
  solves: ["solve", "Go to Solve"],
  drill: ["training", "Go to Drill Algorithms"],
  recognize: ["trainer", "Go to Trainers"],
};

type Source = "solves" | "drill" | "recognize";
const SOURCES: [Source, string, string][] = [
  ["solves", "Solves", "Cases that came up in your solves (CFOP: F2L, OLL, PLL · Roux: CMLL)"],
  ["drill", "Drill", "Drill Algorithms: your attempts at each case's algorithms"],
  ["recognize", "Recognize", "Trainers in Recognize mode: the case on the screen — time to your first turn"],
];

/** One table column: a value per row (null: —), how to show it, and how to sort by it. */
interface Column {
  id: string;
  label: string;
  title?: string;
  show: (v: number) => string;
  /** Sorting by it puts the largest first (counts, slowest…). */
  desc?: boolean;
  strong?: boolean;
  /** Hidden on phones (the table fits a narrow screen with the main columns). */
  wide?: boolean;
}

interface Row {
  name: string;
  kase?: AlgorithmCase;
  /** Sorts "most seen" and hides the row when "not seen" rows are off. */
  count: number;
  values: Record<string, number | null>;
  lastAt?: number;
}

const s2 = (ms: number) => fmtMs(ms);
const times = (n: number) => `${n}×`;
const COLUMNS: Record<Source, Column[]> = {
  solves: [
    { id: "count", label: "Seen", show: times, desc: true },
    { id: "mean", label: "Average", title: "Recognition + execution, average", show: s2, strong: true },
    { id: "best", label: "Best", show: s2 },
    { id: "recog", label: "Recog.", title: "Average pause before the first move", show: s2, desc: true },
    { id: "exec", label: "Exec.", wide: true, title: "Average time turning", show: s2 },
    { id: "moves", label: "Moves", wide: true, show: (v) => v.toFixed(1) },
    { id: "drill", label: "Drill best", wide: true, title: "Your best single in Drill Algorithms (any of the case's algorithms)", show: (v) => fmtSec(v) },
  ],
  drill: [
    { id: "count", label: "Tries", show: String, desc: true },
    { id: "best", label: "Best", show: (v) => fmtSec(v), strong: true },
    { id: "mean", label: "Mean", show: (v) => fmtSec(v) },
    { id: "ao5", label: "Best ao5", title: "The best ao5 of any of its algorithms", show: (v) => fmtSec(v) },
    { id: "ao12", label: "Best ao12", wide: true, show: (v) => fmtSec(v) },
    { id: "algs", label: "Algorithms", wide: true, title: "Algorithms you've drilled for it", show: String, desc: true },
  ],
  recognize: [
    { id: "count", label: "Tries", show: String, desc: true },
    { id: "recog", label: "Recognition", title: "Average time from the case on the screen to your first turn", show: s2, strong: true, desc: true },
    { id: "bestRecog", label: "Best recog.", wide: true, show: s2 },
    { id: "mean", label: "Average", title: "Recognition + solving, average", show: s2 },
    { id: "best", label: "Best", show: s2 },
    { id: "moves", label: "Moves", wide: true, show: (v) => v.toFixed(1) },
  ],
};

function casesOfSet(kind: CaseKind): AlgorithmCase[] {
  const { group, subgroup } = caseLocation(kind);
  return subgroup ? getSubgroupCases(group, subgroup) : loadAlgGroup(group);
}

/** "OLL 9" < "OLL 10": numbers compared as numbers. */
const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

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

function Tabs<T extends string>({ items, value, onChange }: { items: readonly (readonly [T, ReactNode, string?])[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
      {items.map(([id, label, title]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={title}
          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${value === id ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function CaseStatsPage() {
  const solves = useMemo(() => collectCaseStats(getSolves()), []);
  const recognized = useMemo(() => recognizeStats(getTrainerAttempts()), []);
  const [source, setSource] = useState<Source>("solves");
  const [kind, setKind] = useState<CaseKind>("f2l");
  const [sortBy, setSortBy] = useState<string>("count");
  const [showUnseen, setShowUnseen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const columns = COLUMNS[source];
  const sortColumn = columns.find((c) => c.id === sortBy) ?? columns[0];
  const kinds = source === "recognize" ? KINDS.filter((k) => k !== "f2l") : KINDS;
  const shownKind = kinds.includes(kind) ? kind : kinds[0];

  const rows = useMemo<Row[]>(() => {
    const set = casesOfSet(shownKind);
    const caseOf = new Map(set.map((c) => [c.name, c]));
    if (source === "drill") {
      return drillStats(shownKind).map((d) => ({
        name: d.name,
        kase: d.kase,
        count: d.tries,
        values: { count: d.tries, best: d.best, mean: d.mean, ao5: d.bestAo5, ao12: d.bestAo12, algs: d.drilled },
      }));
    }
    const found: Row[] = [];
    if (source === "solves") {
      for (const c of solves.cases.values())
        if (c.kind === shownKind)
          found.push({
            name: c.name,
            kase: caseOf.get(c.name),
            count: c.count,
            lastAt: c.lastAt,
            values: { count: c.count, mean: c.meanMs, best: c.bestMs, recog: c.meanRecognitionMs, exec: c.meanExecutionMs, moves: c.meanMoves, drill: drillBest(caseOf.get(c.name)) },
          });
    } else {
      for (const c of recognized.values())
        if (c.kind === shownKind)
          found.push({
            name: c.name,
            kase: caseOf.get(c.name),
            count: c.count,
            lastAt: c.lastAt,
            values: { count: c.count, recog: c.meanRecognitionMs, bestRecog: c.bestRecognitionMs, mean: c.meanMs, best: c.bestMs, moves: c.meanMoves },
          });
    }
    const have = new Set(found.map((r) => r.name));
    const unseen = set.filter((c) => !have.has(c.name)).map((c) => ({ name: c.name, kase: c, count: 0, values: {} }));
    return [...found, ...unseen];
  }, [source, shownKind, solves, recognized]);

  const sorted = useMemo(() => {
    const visible = showUnseen ? rows : rows.filter((r) => r.count > 0);
    const v = (r: Row) => r.values[sortColumn.id] ?? null;
    return [...visible].sort((a, b) => {
      const x = v(a), y = v(b);
      if (x === null || y === null) return x === y ? byName(a.name, b.name) : x === null ? 1 : -1;
      return (sortColumn.desc ? y - x : x - y) || byName(a.name, b.name);
    });
  }, [rows, showUnseen, sortColumn]);

  const counts = useMemo(() => {
    const out: Record<CaseKind, number> = { f2l: 0, oll: 0, pll: 0, cmll: 0 };
    if (source === "solves") for (const c of solves.cases.values()) out[c.kind] += c.count;
    else if (source === "recognize") for (const c of recognized.values()) out[c.kind] += c.count;
    else for (const k of KINDS) out[k] = drillStats(k).reduce((n, d) => n + d.tries, 0);
    return out;
  }, [source, solves, recognized]);

  const skips = solves.skips[shownKind];
  const total = counts[shownKind] + skips;
  const openRow = open ? rows.find((r) => r.name === open) : undefined;

  const empty: Record<Source, string> = {
    solves: `No ${CASE_KIND_LABEL[shownKind]} cases in your solves yet — they're recognised in ${shownKind === "cmll" ? "Roux" : "CFOP"} solves on the Solve tab.`,
    drill: `No ${CASE_KIND_LABEL[shownKind]} drill attempts yet — practise the cases in Drill Algorithms.`,
    recognize: `No ${CASE_KIND_LABEL[shownKind]} Recognize attempts yet — Trainers → ${CASE_KIND_LABEL[shownKind]}, Recognize.`,
  };

  return (
    <main className="w-full px-4 sm:px-6 py-3 flex flex-col gap-4">
      <PageLabel className="pt-1.5">Stats</PageLabel>
      <div className="flex flex-wrap items-center gap-3">
        <Tabs items={SOURCES} value={source} onChange={(s) => { setSource(s); setSortBy("count"); }} />
        <Tabs
          items={kinds.map((k) => [k, <>{CASE_KIND_LABEL[k]} <span className="text-gray-500 font-mono">{counts[k]}</span></>] as const)}
          value={shownKind}
          onChange={setKind}
        />
        <select
          value={sortColumn.id}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-gray-950/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[var(--accent)]"
          title="Sort by"
        >
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} {c.desc ? "↓" : "↑"}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
          <input type="checkbox" checked={showUnseen} onChange={(e) => setShowUnseen(e.target.checked)} />
          All cases
        </label>
        {source === "solves" && (
          <span className="text-[11px] text-gray-500 ml-auto">
            {solves.solves} solves · {shownKind === "cmll" ? "Roux" : "CFOP"}
            {skips > 0 && total > 0 && (
              <>
                {" · "}
                {shownKind === "f2l" ? "two pairs at once" : `${CASE_KIND_LABEL[shownKind]} skip`} {skips}× ({Math.round((skips / total) * 100)}%)
              </>
            )}
          </span>
        )}
        {source === "drill" && shownKind === "f2l" && <span className="text-[11px] text-gray-500 ml-auto">F2L: the Front Right set</span>}
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-gray-500">
          <BarChart3 size={28} />
          <p className="text-sm">{empty[source]}</p>
          <button onClick={() => openTab(EMPTY_LINK[source][0])} className="text-xs font-semibold text-[var(--accent-bright)] hover:underline">
            {EMPTY_LINK[source][1]} →
          </button>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-gray-500 text-right">
                <th className="text-left font-semibold px-3 py-2" colSpan={2}>
                  Case
                </th>
                {columns.map((c) => (
                  <th key={c.id} className={`font-semibold px-2 py-2 cursor-pointer hover:text-gray-300 ${c.wide ? "hidden md:table-cell" : ""}`} title={c.title} onClick={() => setSortBy(c.id)}>
                    {c.label}
                    {c.id === sortColumn.id && " ·"}
                  </th>
                ))}
                {source !== "drill" && <th className="hidden md:table-cell font-semibold px-3 py-2">Last</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.name}
                  onClick={() => setOpen(r.name)}
                  className="border-t border-white/[0.05] hover:bg-white/[0.04] cursor-pointer text-right font-mono tabular-nums text-gray-300"
                  title="Algorithms and drill stats for this case"
                >
                  <td className="pl-3 py-1.5 w-14">
                    <CasePicture kind={shownKind} kase={r.kase} />
                  </td>
                  <td className="text-left px-2 py-1.5 font-sans">
                    <div className="text-sm font-semibold text-gray-100">{caseTitle({ kind: shownKind, name: r.name })}</div>
                    {r.kase?.category && <div className="text-[10px] text-gray-500">{r.kase.category}</div>}
                  </td>
                  {columns.map((c) => {
                    const v = r.values[c.id];
                    return (
                      <td key={c.id} className={`px-2 ${c.strong ? "text-gray-100 font-semibold" : ""} ${c.wide ? "hidden md:table-cell" : ""}`}>
                        {v === null || v === undefined || (c.id === "count" && v === 0) ? "—" : c.show(v)}
                      </td>
                    );
                  })}
                  {source !== "drill" && <td className="hidden md:table-cell px-3 font-sans text-gray-500">{r.lastAt ? formatRelativeTime(r.lastAt) : "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <CaseAlgorithmsModal
          kind={shownKind}
          name={open}
          solveStats={solves.cases.get(caseKey({ kind: shownKind, name: open })) ?? null}
          recognizeStats={recognized.get(caseKey({ kind: shownKind, name: open })) ?? null}
          onClose={() => setOpen(null)}
          key={openRow?.name}
        />
      )}
    </main>
  );
}
