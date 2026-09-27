/**
 * AnalyzePage — a scramble through CFOP, Roux and ZZ, step by step, the
 * way a solver could go (cubecore's analyser, in a worker):
 *
 *   CFOP  the cross (or XCross… with pairs solved together) optimal, the
 *         pairs in the best order (fewest moves, or by their cases'
 *         algorithms), OLL / PLL by algorithm — per cross colour;
 *   Roux  first block, second square + block, CMLL by algorithm, LSE
 *         optimal (EO / UL-UR / L4E) — per side;
 *   ZZ    EOCross + pairs (R U L), or EOLine + blocks — per cross colour.
 *
 * Each method's best line is shown with its steps; the per-colour lengths
 * pick another line; any line plays on the 3D cube. Opened from a solve
 * (Analyze in its analysis), the scramble comes filled in and your solve is
 * shown next to the lines.
 */

import { openTab } from "../services/tabNav";
import { getSolves } from "../services/solveStore";
import { PageLabel } from "../components/PageLabel";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import type { Analysis, AnalysisStep, CrossAnalysis, RouxAnalysis, RouxAnalysisResult, RouxStep, ZZAnalysis, ZZAnalysisResult } from "@wodzik/cubecore/analyze";
import { type Face, type Move, formatAlg, parseAlg } from "@wodzik/cubecore/core";
import { cubecoreAnalyzer } from "../services/cubecoreAnalyzer";
import { cubecoreSolver } from "../services/cubecoreSolver";
import type { AnalyzeRequest } from "../services/analyzeNav";
import { CubeVisualisation } from "../components/CubeVisualisation";
import { formatTimeMs } from "../logic/statistics";

const COLOUR: Record<Face, [string, string]> = {
  U: ["White", "#f4f4f5"],
  D: ["Yellow", "#facc15"],
  F: ["Green", "#22c55e"],
  B: ["Blue", "#3b82f6"],
  R: ["Red", "#ef4444"],
  L: ["Orange", "#f97316"],
};

type Method = "cfop" | "roux" | "zz";
type Start = "cross" | "xcross" | "xxcross" | "xxxcross";

interface Options {
  start: Start;
  f2l: "optimal" | "algorithms";
  colours: "all" | "white" | "whiteYellow";
  zz: "eocross" | "eoline";
}

interface Results {
  cfop: Analysis | null;
  roux: RouxAnalysisResult | null;
  zz: ZZAnalysisResult | null;
}

/** One line to show / play: its steps as rows, the grip, the length. */
interface Line {
  method: Method;
  /** Which alternative: the cross colour (CFOP / ZZ) or the first block's side (Roux). */
  id: Face;
  face: Face;
  rotation: string;
  rows: { label: string; detail?: string; moves: Move[] }[];
  length: number;
  unit: "HTM" | "STM";
}

const SLOT_NAMES: Record<string, string> = { FR: "FR", FL: "FL", BR: "BR", BL: "BL" };

function cfopLine(a: CrossAnalysis | ZZAnalysis, method: "cfop" | "zz"): Line {
  const rows = a.steps.map((s: AnalysisStep) => {
    switch (s.step) {
      case "cross":
        return { label: method === "zz" ? "EOCross" : s.slots?.length ? `XCross ${s.slots.map((x) => SLOT_NAMES[x]).join("+")}` : "Cross", moves: s.moves };
      case "pair":
        return { label: `${SLOT_NAMES[s.slot]} pair`, detail: s.case, moves: s.moves };
      case "oll":
        return { label: "OLL", detail: s.case, moves: s.moves };
      case "pll":
        return { label: "PLL", detail: s.case, moves: s.moves };
      case "auf":
        return { label: "AUF", moves: s.moves };
      case "eoline":
        return { label: "EOLine", moves: s.moves };
      case "block":
        return { label: `${s.side === "left" ? "Left" : "Right"} block`, moves: s.moves };
    }
  });
  return { method, id: a.face, face: a.face, rotation: a.rotation, rows, length: a.length, unit: "HTM" };
}

function rouxLine(a: RouxAnalysis): Line {
  const rows = a.steps.map((s: RouxStep) => {
    switch (s.step) {
      case "fb":
        return { label: "First block", moves: s.moves };
      case "ss":
        return { label: "Second square", detail: s.side, moves: s.moves };
      case "sb":
        return { label: "Second block", moves: s.moves };
      case "cmll":
        return { label: "CMLL", detail: s.case, moves: s.moves };
      case "lse":
        return { label: "LSE", detail: `EO ${s.eo} · UL/UR ${s.ulur} · L4E ${s.l4e}`, moves: s.moves };
    }
  });
  return { method: "roux", id: a.side, face: a.bottom, rotation: a.rotation, rows, length: a.length, unit: "STM" };
}

const METHOD_LABEL: Record<Method, string> = { cfop: "CFOP", roux: "Roux", zz: "ZZ" };

const METHODS: Method[] = ["cfop", "roux", "zz"];

export default function AnalyzePage({ request }: { request?: AnalyzeRequest | null }) {
  const [scramble, setScramble] = useState(request?.scramble ?? "");
  const hasSolves = useMemo(() => getSolves().length > 0, []);
  const [draft, setDraft] = useState(request?.scramble ?? "");
  const [solve, setSolve] = useState(request?.solve ?? null);
  const [options, setOptions] = useState<Options>({ start: "cross", f2l: "optimal", colours: "all", zz: "eocross" });
  const [results, setResults] = useState<Results>({ cfop: null, roux: null, zz: null });
  const [busy, setBusy] = useState<Method[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** The method shown (a tab): its options, its line on the cube. */
  const [method, setMethod] = useState<Method>(() => (request?.solve?.method === "Roux" ? "roux" : "cfop"));
  /** Per method, the alternative picked (cross colour / block side) — else its best. */
  const [picked, setPicked] = useState<Record<Method, Face | null>>({ cfop: null, roux: null, zz: null });

  // A new request (Analyze from a solve) fills the scramble in.
  useEffect(() => {
    if (!request) return;
    setScramble(request.scramble);
    setDraft(request.scramble);
    setSolve(request.solve ?? null);
    if (request.solve?.method === "Roux") setMethod("roux");
    else if (request.solve?.method === "CFOP") setMethod("cfop");
  }, [request]);

  const crosses = useMemo<Face[] | undefined>(() => (options.colours === "white" ? ["U"] : options.colours === "whiteYellow" ? ["U", "D"] : undefined), [options.colours]);

  // Each method is analysed when the scramble or ITS options change (a CFOP option doesn't redo Roux).
  const run = useCallback(<T,>(m: Method, job: () => Promise<T>, set: (v: T) => void) => {
    let cancelled = false;
    setResults((r) => ({ ...r, [m]: null }));
    setPicked((p) => ({ ...p, [m]: null }));
    setBusy((b) => [...b.filter((x) => x !== m), m]);
    job()
      .then((v) => !cancelled && set(v), (e: unknown) => !cancelled && setError(`${METHOD_LABEL[m]}: ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => !cancelled && setBusy((b) => b.filter((x) => x !== m)));
    return () => {
      cancelled = true;
    };
  }, []);
  const valid = useMemo(() => {
    const text = scramble.trim();
    if (!text) return null;
    try {
      parseAlg(text);
      return text;
    } catch {
      return null;
    }
  }, [scramble]);
  useEffect(() => {
    if (scramble.trim() && !valid) setError("Not a scramble — check the notation.");
    else setError(null);
  }, [scramble, valid]);
  useEffect(() => {
    if (!valid) return;
    return run("cfop", () => cubecoreAnalyzer().analyze(valid, { start: options.start, f2l: options.f2l, crosses }), (v) => setResults((r) => ({ ...r, cfop: v })));
  }, [valid, options.start, options.f2l, crosses, run]);
  useEffect(() => {
    if (!valid) return;
    return run("roux", () => cubecoreAnalyzer().analyzeRoux(valid, { bottoms: crosses }), (v) => setResults((r) => ({ ...r, roux: v })));
  }, [valid, crosses, run]);
  useEffect(() => {
    if (!valid) return;
    return run("zz", () => cubecoreAnalyzer().analyzeZZ(valid, { start: options.zz, crosses }), (v) => setResults((r) => ({ ...r, zz: v })));
  }, [valid, options.zz, crosses, run]);

  const randomScramble = async () => {
    const r = await cubecoreSolver().randomScramble({ preset: "full" });
    const s = formatAlg(r.moves);
    setDraft(s);
    setScramble(s);
    setSolve(null);
  };

  // Lines: every alternative, shortest first.
  const lines = useMemo(() => {
    const out: Record<Method, Line[]> = { cfop: [], roux: [], zz: [] };
    if (results.cfop) out.cfop = results.cfop.byCross.map((a) => cfopLine(a, "cfop")).sort((x, y) => x.length - y.length);
    if (results.roux) out.roux = results.roux.bySide.map(rouxLine).sort((x, y) => x.length - y.length);
    if (results.zz) out.zz = results.zz.byCross.map((a) => cfopLine(a, "zz")).sort((x, y) => x.length - y.length);
    return out;
  }, [results]);
  const lineOf = (m: Method): Line | undefined => lines[m].find((l) => l.id === picked[m]) ?? lines[m][0];
  const line = lineOf(method);
  const playAlg = line ? `${line.rotation} ${line.rows.map((r) => formatAlg(r.moves)).join(" ")}`.trim() : "";

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${active ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"}`;
  const chipStyle = (active: boolean) => (active ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined);
  const group = <K extends keyof Options>(label: string, key: K, choices: readonly (readonly [Options[K], string])[]) => (
    <div className="flex items-center gap-1 shrink-0">
      <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">{label}</span>
      {choices.map(([v, l]) => (
        <button key={String(v)} onClick={() => setOptions((o) => ({ ...o, [key]: v }))} className={chip(options[key] === v)} style={chipStyle(options[key] === v)}>
          {l}
        </button>
      ))}
    </div>
  );
  const colourWord = method === "roux" ? "Bottom" : "Cross";

  return (
    <main className="w-full min-w-0 px-4 sm:px-6 py-3 flex flex-col gap-4">
      <PageLabel className="pt-1.5">Analyze</PageLabel>
      {/* Scramble */}
      <form
        className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-w-0"
        onSubmit={(e) => {
          e.preventDefault();
          setScramble(draft);
          setSolve(null);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Paste a scramble, e.g. R U2 F' L2 D B2…"
          spellCheck={false}
          className="w-full sm:w-auto sm:flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 font-mono text-sm text-white outline-none focus:border-white/25"
        />
        <button type="submit" className="btn-secondary text-xs shrink-0">
          <Sparkles size={13} /> Analyze
        </button>
        <button type="button" onClick={() => void randomScramble()} className="btn-secondary text-xs shrink-0" title="A random scramble">
          <RefreshCw size={13} /> Random
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {!scramble.trim() ? (
        <div className="text-sm text-gray-500 py-10 text-center flex flex-col items-center gap-2">
          <p>Paste a scramble (or take a random one) — or open a solve's analysis and press Analyze.</p>
          <button onClick={() => openTab("solve")} className="text-xs font-semibold text-[var(--accent-bright)] hover:underline">
            {hasSolves ? "Your solves are on the Solve tab →" : "No solves yet — make one on the Solve tab →"}
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-6 items-start min-w-0">
          <div className="flex flex-col gap-4 min-w-0">
            {solve && (
              <div className="panel p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Your solve{solve.method ? ` · ${solve.method}` : ""}</p>
                  <p className="text-sm font-mono tabular-nums text-white">
                    {solve.timeMs !== undefined && `${formatTimeMs(solve.timeMs)} · `}
                    {solve.moveCount ?? solve.moves.length} moves
                  </p>
                </div>
                <p className="mt-2 text-xs font-mono text-gray-400 break-all">{solve.moves.join(" ")}</p>
              </div>
            )}

            {/* One method at a time: its tab, its options, its line */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1 w-fit" role="tablist">
                {METHODS.map((m) => {
                  const best = lines[m][0];
                  return (
                    <button
                      key={m}
                      role="tab"
                      aria-selected={method === m}
                      onClick={() => setMethod(m)}
                      className={`flex items-baseline gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${method === m ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"}`}
                    >
                      {METHOD_LABEL[m]}
                      <span className="text-xs font-mono tabular-nums font-normal text-gray-500">
                        {busy.includes(m) ? <RefreshCw size={11} className="animate-spin inline" /> : best ? `${best.length}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {group(method === "roux" ? "Block bottom" : "Cross colour", "colours", [["all", "All"], ["whiteYellow", "White + yellow"], ["white", "White"]])}
                {method === "cfop" && group("Start", "start", [["cross", "Cross"], ["xcross", "XCross"], ["xxcross", "XXCross"], ["xxxcross", "XXXCross"]])}
                {method === "cfop" && group("F2L", "f2l", [["optimal", "Fewest moves"], ["algorithms", "Algorithms"]])}
                {method === "zz" && group("Start", "zz", [["eocross", "EOCross"], ["eoline", "EOLine"]])}
              </div>
            </div>

            <div className="panel p-4">
              {busy.includes(method) && (
                <p className="flex items-center gap-1.5 text-xs text-gray-500">
                  <RefreshCw size={12} className="animate-spin" /> Analyzing… (the first time builds its tables)
                </p>
              )}
              {line && (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-lg font-mono tabular-nums font-bold text-white">
                      {line.length} <span className="text-xs font-normal text-gray-500">{line.unit}</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      {method === "roux" ? "bottom" : "cross"} <span style={{ color: COLOUR[line.face][1] }}>{COLOUR[line.face][0]}</span>
                      {line.rotation && <span className="font-mono"> · hold {line.rotation}</span>}
                    </span>
                  </div>
                  {/* Every alternative (also when there's just one — it says which colour this is) */}
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">{colourWord}</span>
                    {lines[method].map((l) => {
                      const active = line.id === l.id;
                      return (
                        <button
                          key={l.id}
                          onClick={() => setPicked((p) => ({ ...p, [method]: l.id }))}
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono tabular-nums ${active ? "bg-white/[0.08] text-white" : "text-gray-500 hover:text-gray-300"}`}
                          title={`${colourWord} ${COLOUR[l.face][0]}${method === "roux" ? ` (block on ${l.id})` : ""}`}
                        >
                          <span className="size-2.5 rounded-sm" style={{ background: COLOUR[l.face][1] }} />
                          {l.length}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-col divide-y divide-white/[0.04]">
                    {line.rows.map((r, i) => (
                      <div key={i} className="flex items-baseline gap-3 py-1.5">
                        <span className="w-24 sm:w-28 shrink-0 text-xs font-semibold text-gray-300">{r.label}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-mono text-xs text-gray-200 break-words">{formatAlg(r.moves) || "—"}</span>
                          {/* phones: the detail under the moves (beside them it would squeeze them) */}
                          {r.detail && <span className="sm:hidden block text-[11px] text-gray-500 mt-0.5">{r.detail}</span>}
                        </span>
                        {r.detail && <span className="hidden sm:inline text-[11px] text-gray-500 shrink-0 max-w-[40%] text-right">{r.detail}</span>}
                        <span className="w-8 text-right text-[11px] font-mono tabular-nums text-gray-500 shrink-0">{r.moves.length}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* The cube: the scramble, then the line of the method shown */}
          <div className="lg:sticky lg:top-24 flex flex-col items-center gap-2 min-w-0">
            <div className="w-full max-w-80 aspect-square">
              <CubeVisualisation key={`${scramble}|${playAlg}`} setupAlg={scramble} alg={playAlg} controlPanel="bottom-row" tempoScale={2} className="size-full" />
            </div>
            {line && (
              <p className="text-xs text-gray-400 text-center">
                <span className="font-semibold text-gray-200">{METHOD_LABEL[method]}</span> · {COLOUR[line.face][0]} · {line.length} {line.unit}
              </p>
            )}
            <p className="text-[11px] text-gray-600 font-mono text-center break-words px-2 max-w-full">{scramble}</p>
          </div>
        </div>
      )}
    </main>
  );
}
