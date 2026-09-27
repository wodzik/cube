/**
 * One algorithm case: how it went in your solves, and every algorithm you
 * have for it in Drill Algorithms with its drill stats — ⚡ the fastest
 * single, 🏆 the best average (the most consistent) — and a Drill button
 * that opens Drill Algorithms on that algorithm.
 */

import { useMemo, useState } from "react";
import { Dumbbell, Trophy, Zap } from "lucide-react";
import { OverlayModal } from "./OverlayModal";
import { AlgCaseVisualisation } from "./AlgCaseVisualisation";
import { getGroupMeta, resolveDisplayConfig, resolveStickeringProps } from "../services/algGroupRegistry";
import { getDefaultVariant } from "../logic/algGroupConfig";
import { openDrill } from "../services/drillNav";
import { getSolves } from "../services/solveStore";
import { type CaseKind, CASE_KIND_LABEL, caseLocation, caseTitle } from "../logic/solveCases";
import { type CaseRecognizeStats, type CaseSolveStats, caseKey, collectCaseStats, drillCase, fmtMs, fmtSec, recognizeStats, variantStats } from "../logic/caseStats";
import { getTrainerAttempts } from "../services/trainerStore";
import { formatRelativeTime } from "../logic/statistics";

interface CaseAlgorithmsModalProps {
  kind: CaseKind;
  name: string;
  onClose: () => void;
  /** This case's stats from solves, if the caller has them (else computed from all solves). */
  solveStats?: CaseSolveStats | null;
  /** Its Recognize stats from the trainers, if the caller has them (else computed). */
  recognizeStats?: CaseRecognizeStats | null;
  /** Called before switching to Drill Algorithms (e.g. to close the modal it was opened from). */
  onNavigate?: () => void;
  layerClassName?: string;
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex flex-col" title={title}>
      <span className="text-[10px] uppercase tracking-widest text-gray-500">{label}</span>
      <span className="text-sm font-mono tabular-nums text-gray-100">{value}</span>
    </div>
  );
}

export function CaseAlgorithmsModal({ kind, name, onClose, solveStats, recognizeStats: recognizedIn, onNavigate, layerClassName }: CaseAlgorithmsModalProps) {
  const location = caseLocation(kind);
  const kase = useMemo(() => drillCase(kind, name), [kind, name]);
  const stats = useMemo(() => (solveStats !== undefined ? solveStats : (collectCaseStats(getSolves()).cases.get(caseKey({ kind, name })) ?? null)), [kind, name, solveStats]);
  const variants = useMemo(() => (kase ? variantStats(kase) : null), [kase]);
  const recognized = useMemo(
    () => (recognizedIn !== undefined ? recognizedIn : (recognizeStats(getTrainerAttempts()).get(caseKey({ kind, name })) ?? null)),
    [kind, name, recognizedIn]
  );
  // Algorithms you've drilled (and the default one) first; the rest of the set on request.
  const [showAll, setShowAll] = useState(false);
  const listed = variants ? variants.rows.filter((r) => showAll || r.count > 0 || r.variant.isDefault) : [];
  const hidden = variants ? variants.rows.length - listed.length : 0;

  const groupMeta = getGroupMeta(location.group);
  const subgroupMeta = location.subgroup ? groupMeta?.subgroups?.find((s) => s.id === location.subgroup) : undefined;
  const display = resolveDisplayConfig(groupMeta, subgroupMeta?.displayConfig, kase?.displayConfigOverride);
  const pictureAlg = kase ? (getDefaultVariant(kase)?.alg ?? "").replace(/[()]/g, "").replace(/\s+/g, " ").trim() : "";

  const drill = (variantId?: string) => {
    onNavigate?.();
    onClose();
    openDrill({ group: location.group, subgroup: location.subgroup, caseName: name, variantId });
  };

  return (
    <OverlayModal
      onClose={onClose}
      layerClassName={layerClassName}
      className="w-[min(97vw,52rem)]"
      header={
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-white font-semibold text-base truncate">{caseTitle({ kind, name })}</h2>
          {kase?.category && <span className="text-xs text-gray-500 truncate">{kase.category}</span>}
        </div>
      }
    >
      <div className="flex flex-col sm:flex-row gap-5">
        <div className="sm:w-48 shrink-0 flex flex-col gap-3">
          {pictureAlg && (
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-950/50">
              <AlgCaseVisualisation
                alg={pictureAlg}
                visualization={display.cardVisualization}
                cameraLatitude={display.cameraLatitude}
                cameraLongitude={display.cameraLongitude}
                {...resolveStickeringProps(display.stickering)}
                className="size-full"
              />
            </div>
          )}
          {kase && (
            <button onClick={() => drill()} className="btn-primary text-xs w-full justify-center" title="Drill this case in Drill Algorithms">
              <Dumbbell size={13} /> Drill this case
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <section>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">In your solves</h3>
            {stats ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                <Stat label="Seen" value={`${stats.count}×`} />
                <Stat label="Average" value={`${fmtMs(stats.meanMs)}s`} title="Recognition + execution, average" />
                <Stat label="Best" value={`${fmtMs(stats.bestMs)}s`} />
                <Stat label="Moves" value={stats.meanMoves.toFixed(1)} title="Average moves" />
                <Stat label="Recognition" value={`${fmtMs(stats.meanRecognitionMs)}s`} title="Average pause before the first move" />
                <Stat label="Execution" value={`${fmtMs(stats.meanExecutionMs)}s`} title="Average time turning" />
                <Stat label="Last seen" value={formatRelativeTime(stats.lastAt)} />
              </div>
            ) : (
              <p className="text-xs text-gray-500">Not in your {kind === "cmll" ? "Roux" : "CFOP"} solves yet.</p>
            )}
          </section>

          {recognized && (
            <section>
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">In the trainer · Recognize</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                <Stat label="Tries" value={String(recognized.count)} />
                <Stat label="Recognition" value={`${fmtMs(recognized.meanRecognitionMs)}s`} title="Average time from the case on the screen to your first turn" />
                <Stat label="Best recog." value={`${fmtMs(recognized.bestRecognitionMs)}s`} />
                <Stat label="Average" value={`${fmtMs(recognized.meanMs)}s`} title="Recognition + solving, average" />
              </div>
            </section>
          )}

          <section>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Algorithms <span className="normal-case tracking-normal text-gray-500">· Drill Algorithms, {CASE_KIND_LABEL[kind]}</span>
            </h3>
            {!kase || !variants ? (
              <p className="text-xs text-gray-500">This case isn't in your Drill Algorithms set.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {listed.map((r) => (
                  <div key={r.variant.id} className="flex items-center gap-3 px-2.5 py-2 rounded-lg bg-white/[0.03]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-300 truncate">{r.variant.name}</span>
                        {r.variant.isDefault && <span className="text-[9px] uppercase tracking-wider text-gray-500">default</span>}
                        {variants.fastest === r.variant.id && (
                          <span title="Fastest single" className="text-amber-300">
                            <Zap size={13} fill="currentColor" />
                          </span>
                        )}
                        {variants.mostConsistent === r.variant.id && (
                          <span title="Best average (ao12, else ao5) — the most consistent" className="text-sky-300">
                            <Trophy size={13} />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-gray-100 break-words">{r.variant.alg}</p>
                    </div>
                    <div className="shrink-0 grid grid-cols-5 gap-3 text-right text-[11px] font-mono tabular-nums">
                      <Stat label="Tries" value={String(r.count)} />
                      <Stat label="Best" value={fmtSec(r.best)} />
                      <Stat label="Mean" value={fmtSec(r.mean)} />
                      <Stat label="ao5" value={fmtSec(r.ao5)} />
                      <Stat label="ao12" value={fmtSec(r.ao12)} />
                    </div>
                    <button onClick={() => drill(r.variant.id)} className="btn-secondary text-[11px] py-1 shrink-0" title="Drill this algorithm">
                      <Dumbbell size={12} /> Drill
                    </button>
                  </div>
                ))}
                {(hidden > 0 || showAll) && variants.rows.some((r) => r.count === 0 && !r.variant.isDefault) && (
                  <button onClick={() => setShowAll((v) => !v)} className="text-[11px] text-gray-400 hover:text-gray-200 self-start px-2.5 py-1">
                    {showAll ? "Only the ones you've drilled" : `Show all ${variants.rows.length} algorithms (${hidden} not drilled yet)`}
                  </button>
                )}
                <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Zap size={11} className="text-amber-300" fill="currentColor" /> fastest single
                  </span>
                  <span className="flex items-center gap-1">
                    <Trophy size={11} className="text-sky-300" /> best average
                  </span>
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </OverlayModal>
  );
}
