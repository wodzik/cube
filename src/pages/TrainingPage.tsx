/**
 * TrainingPage — algorithm case browser + practice.
 *
 * Thin controller: same session reducer as SolvePage (mode: "algorithm"),
 * same TrainerPanel shell. Selecting a case just calls setTarget(alg) — the
 * reducer's "setup" (waiting for first move) -> "active" (tracked, first
 * move starts the timer) -> "done" transitions are identical to how
 * SolvePage's scramble tracking works; this page has no move-matching logic
 * of its own.
 *
 * Practice rotation cycles through the CHECKED cases (case_.selected) from
 * the browser below, not through every case in the group — matches the
 * original design: the grid/list view manages the selection + editing,
 * the drill panel above just cycles through whatever is selected.
 *
 * Unlike SolvePage's live-mirrored cube (which starts from solved and
 * mirrors every physical move), here the cube is declaratively pre-set to
 * the case's scrambled state via cubeSetupAlg = inverse(algorithm) — the
 * user hasn't physically scrambled anything, we're showing them the case.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { SessionProvider, useSession } from "../state/sessionContext";
import { selectCurrentProgress, selectMoveCount } from "../state/sessionSelectors";
import { buildSequenceTarget, computeSequenceProgress } from "../logic/sequenceTracker";
import { invertSequence } from "../logic/moveParser";
import { getDefaultVariant, STICKERING, CAMERA } from "../logic/algGroupConfig";
import { attemptsForSource } from "../logic/statistics";
import {
  loadAlgGroup,
  recordAttempt,
  setLearningStatus,
  setCaseSelected,
  setSelectedBatch,
  updateCase,
} from "../services/algorithmStore";
import { useSmartCube } from "../hooks/useSmartCube";
import { useAnimationTimer } from "../hooks/useAnimationTimer";
import { useMaskMoves } from "../hooks/useMaskMoves";
import { usePendingMoveBuffer } from "../hooks/usePendingMoveBuffer";
import { useCaseViewPrefs } from "../hooks/useCaseViewPrefs";
import { useCubeViewRefs } from "../hooks/useCubeViewRefs";
import { TrainerPanel } from "../components/TrainerPanel";
import { ConnectionPanel } from "../components/ConnectionPanel";
import { AlgorithmListView } from "../components/AlgorithmListView";
import { CaseEdit } from "../components/CaseEdit";
import { CaseViewToggles } from "../components/CaseViewToggles";
import type { SessionConfig } from "../types/session";
import type { AlgGroup, AlgorithmCase } from "../types/algorithm";

const TRAINING_CONFIG: SessionConfig = {
  mode: "algorithm",
  startMethod: ["cube-move"],
  stopMethod: ["cube-solved"],
  useInspection: false,
  inspectionSeconds: 15,
};

const GROUPS: { id: AlgGroup; label: string }[] = [
  { id: "f2l-front-right", label: "F2L FR" },
  { id: "f2l-front-left", label: "F2L FL" },
  { id: "f2l-back-right", label: "F2L BR" },
  { id: "f2l-back-left", label: "F2L BL" },
  { id: "f2l-advanced", label: "F2L Adv" },
  { id: "oll", label: "OLL" },
  { id: "pll", label: "PLL" },
];

function invertAlg(alg: string): string {
  const moves = alg.trim().split(/\s+/).filter(Boolean);
  return moves.length === 0 ? "" : invertSequence(moves).join(" ");
}

export default function TrainingPage() {
  return (
    <SessionProvider config={TRAINING_CONFIG}>
      <TrainingPageInner />
    </SessionProvider>
  );
}

function TrainingPageInner() {
  const { state, submitCubeMove, setTarget, reset } = useSession();
  const { cubeRef, flatCubeRef, view } = useCubeViewRefs();
  const { maskMoves, toggleMaskMoves } = useMaskMoves();

  const [group, setGroup] = useState<AlgGroup>("f2l-front-right");
  const viewPrefs = useCaseViewPrefs(group.startsWith("f2l"), "practice");
  const [cases, setCases] = useState<AlgorithmCase[]>(() => loadAlgGroup(group));
  const [caseIdx, setCaseIdx] = useState(0);
  // Bumped on every auto-advance so the case-loading effect re-runs even
  // when the NEXT case is the SAME case — with a single selected case,
  // keying on variant.id alone never reloaded and the drill stalled after
  // one attempt.
  const [drillRound, setDrillRound] = useState(0);
  const [editingCase, setEditingCase] = useState<AlgorithmCase | null>(null);
  const [jumpToCaseName, setJumpToCaseName] = useState<string | null>(null);
  const moveBuffer = usePendingMoveBuffer(state.phase);

  const reload = () => setCases(loadAlgGroup(group));

  useEffect(() => {
    setCases(loadAlgGroup(group));
    setCaseIdx(0);
    // A manual navigation — moves buffered toward the auto-advanced case
    // don't belong to the group the user just switched to.
    moveBuffer.clear();
  }, [group, moveBuffer]);

  const selectedCases = useMemo(() => cases.filter((c) => c.selected), [cases]);

  // Clamp when the selected set shrinks (e.g. a case gets deselected mid-practice).
  useEffect(() => {
    if (selectedCases.length > 0 && caseIdx >= selectedCases.length) setCaseIdx(0);
  }, [selectedCases.length, caseIdx]);

  // "Practice this now" from the browser below: select the case if it isn't
  // already, then jump the drill to it as soon as it shows up in
  // selectedCases (which may be on the next render, once `reload()` from the
  // selection change propagates through).
  const practiceNow = (caseName: string) => {
    const target = cases.find((c) => c.name === caseName);
    if (!target) return;
    if (!target.selected) {
      setCaseSelected(group, caseName, true);
      reload();
    }
    moveBuffer.clear(); // manual jump — drop moves aimed at the auto-advanced case
    setJumpToCaseName(caseName);
  };

  useEffect(() => {
    if (!jumpToCaseName) return;
    const idx = selectedCases.findIndex((c) => c.name === jumpToCaseName);
    if (idx >= 0) {
      setCaseIdx(idx);
      setJumpToCaseName(null);
    }
  }, [jumpToCaseName, selectedCases]);

  const currentCase = selectedCases[caseIdx] ?? null;
  const variant = currentCase ? getDefaultVariant(currentCase) : undefined;

  // Load the case's algorithm as the target, and pre-set the cube to its
  // scrambled state, whenever the case (or its variant) changes — or the
  // drill advances to another round of the SAME case (drillRound).
  useEffect(() => {
    if (!variant) return;
    reset();
    setTarget(variant.alg);
    view.reset();
    const inv = invertAlg(variant.alg);
    if (inv) view.setSetupAlgorithm(inv, "");
    // Moves made while the previous attempt was finishing up (phase "done",
    // e.g. chaining the next execution immediately) belong to THIS attempt —
    // replay them now that the target is armed, stopping if they complete it
    // (any tail beyond completion waits for the round after).
    const flushTarget = buildSequenceTarget(variant.alg);
    const delivered: string[] = [];
    moveBuffer.flush((move, timestamp) => {
      submitCubeMove(move, timestamp);
      view.addMove(move);
      delivered.push(move);
      return !computeSequenceProgress(flushTarget, delivered).isCompleted;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant?.id, drillRound]);

  const cube = useSmartCube({
    onMove: (move, timestamp) => {
      // While the edit modal is open, moves belong to IT (its VariantTest
      // popup runs its own listener/session) — feeding them into the drill
      // underneath would advance/record the background case unnoticed.
      if (editingCase) return;
      // Between an attempt completing and the next target arming, the
      // session would DROP moves — capture them for replay instead (fast
      // back-to-back executions used to desync here).
      if (moveBuffer.capture(move, timestamp)) return;
      submitCubeMove(move, timestamp);
      view.addMove(move);
    },
  });

  const displaySec = useAnimationTimer(state.startTime, state.endTime, state.phase === "active");

  // Record the attempt and auto-advance once the algorithm is completed.
  //
  // BUG FIXED: this used to depend on the full `currentCase`/`variant`
  // objects. `reload()` below re-fetches cases from localStorage, which
  // creates NEW object references for the same logical case — that alone
  // made this effect re-run (cleanup + re-invoke), which cancelled the
  // just-scheduled advance timer via its own cleanup before it ever fired.
  // With several cases selected, practice silently stalled after the first
  // one. Depending on stable primitive keys (name/id) instead of the
  // objects avoids the spurious re-run.
  const currentCaseName = currentCase?.name;
  const variantId = variant?.id;

  // Guard by the attempt's IDENTITY (its endTime), not a boolean armed by a
  // pass through a non-"done" phase: when a buffered replay completes a
  // whole attempt inside one effect, React batches reset→setTarget→moves
  // into a single render — the intermediate phases never render, so a
  // boolean guard would swallow the second attempt entirely.
  const lastRecordedEndRef = useRef<number | null>(null);
  useEffect(() => {
    if (state.phase !== "done") return;
    if (!currentCase || !variant || state.startTime === null || state.endTime === null) return;
    if (lastRecordedEndRef.current === state.endTime) return;
    lastRecordedEndRef.current = state.endTime;

    const finalProgress = state.target ? computeSequenceProgress(state.target, state.moveLog.map((m) => m.move)) : null;

    recordAttempt(group, currentCase.name, variant.id, {
      time: (state.endTime - state.startTime) / 1000,
      hadErrors: finalProgress?.hadErrors ?? false,
      source: "training",
    });
    reload();

    const timer = setTimeout(() => {
      setCaseIdx((i) => (i + 1) % Math.max(selectedCases.length, 1));
      // Force the loading effect even when the next case is the same one
      // (single-case drills / repeats in a short rotation).
      setDrillRound((r) => r + 1);
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.startTime, state.endTime, currentCaseName, variantId, group]);

  const progress = selectCurrentProgress(state);
  const moveCount = selectMoveCount(state);
  const targetTokens = variant ? variant.alg.trim().split(/\s+/).filter(Boolean) : [];

  const timerState: "idle" | "solving" | "solved" =
    state.phase === "active" ? "solving" : state.phase === "done" ? "solved" : "idle";

  const hintText = !currentCase
    ? "Select cases below to begin practicing"
    : state.phase === "setup"
      ? "Make a move to start"
      : state.phase === "done"
        ? `${moveCount} moves`
        : null;

  return (
    <>
      <TrainerPanel
        header={
          <div className="flex items-center gap-1 w-full overflow-x-auto">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGroup(g.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all shrink-0 ${
                  group === g.id ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                }`}
                style={group === g.id ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined}
              >
                {g.label}
              </button>
            ))}
            <div className="ml-auto shrink-0">
              <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
            </div>
          </div>
        }
        moves={targetTokens}
        progress={progress}
        showMaskToggle
        maskMoves={maskMoves}
        onToggleMask={toggleMaskMoves}
        loadingText={!currentCase ? "No case selected" : undefined}
        completeText="Algorithm complete!"
        centerTop={
          currentCase ? (
            <div className="flex flex-col items-center gap-1 text-center">
              <h2 className="text-lg font-bold text-white">{currentCase.name}</h2>
              <p className="text-xs text-gray-500">{currentCase.category}</p>
              <p className="text-[11px] text-gray-700 tabular-nums font-mono">
                {caseIdx + 1} / {selectedCases.length}
              </p>
            </div>
          ) : null
        }
        timeMs={displaySec * 1000}
        timerState={timerState}
        hintText={hintText}
        cubeRef={cubeRef}
        visualization="3D"
        stickering={group ? STICKERING[group] : "full"}
        hintFacelets={viewPrefs.backStickers ? "floating" : "none"}
        hintFaceletsElevation={viewPrefs.hintElevation}
        flatCubeRef={flatCubeRef}
        showFlatView={viewPrefs.flatView}
        cubeToolbar={<CaseViewToggles {...viewPrefs} />}
        cameraLatitude={group ? CAMERA[group].latitude : 20}
        cameraLongitude={group ? CAMERA[group].longitude : 20}
        cubeSetupAlg=""
        timesMs={attemptsForSource(variant?.times ?? [], "training").map((t) => t.time * 1000)}
        statsLabel={currentCase ? `Times — ${currentCase.name}` : "Statistics"}
        showAo12={false}
        bottom={
          <AlgorithmListView
            group={group}
            cases={cases}
            onStatusChange={(caseName, variantId, status) => {
              setLearningStatus(group, caseName, variantId, status);
              reload();
            }}
            onSelectedChange={(caseName, selected) => {
              setCaseSelected(group, caseName, selected);
              reload();
            }}
            onSelectAll={(selected, caseNames) => {
              setSelectedBatch(group, selected, caseNames);
              reload();
            }}
            onEdit={(case_) => setEditingCase(case_)}
            onPractice={(case_) => practiceNow(case_.name)}
          />
        }
      />

      {editingCase && (
        <CaseEdit
          case_={editingCase}
          group={group}
          onSave={(updated) => {
            updateCase(group, updated);
            setEditingCase(null);
            reload();
          }}
          onClose={() => setEditingCase(null)}
        />
      )}
    </>
  );
}
