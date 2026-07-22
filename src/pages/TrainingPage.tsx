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
import { Video, ChevronLeft } from "lucide-react";
import { SessionProvider, useSession } from "../state/sessionContext";
import { selectCurrentProgress, selectMoveCount } from "../state/sessionSelectors";
import { buildSequenceTarget, computeSequenceProgress } from "../logic/sequenceTracker";
import { invertSequence } from "../logic/moveParser";
import { getDefaultVariant } from "../logic/algGroupConfig";
import { attemptsForSource } from "../logic/statistics";
import {
  loadAlgGroup,
  recordAttempt,
  setLearningStatus,
  setCaseSelected,
  setSelectedBatch,
  updateCase,
  addCase,
  deleteCase,
} from "../services/algorithmStore";
import {
  getGroupMeta,
  resolveDisplayConfig,
  resolveStickeringProps,
  getSubgroupCases,
  recordSubgroupAttempt,
  setSubgroupLearningStatus,
  updateSubgroupCase,
  addSubgroupCase,
  deleteSubgroupCase,
  setSubgroupCaseSelected,
  setSubgroupSelectedBatch,
} from "../services/algGroupRegistry";
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
import { CaseAddModal } from "../components/CaseAddModal";
import { CaseViewToggles } from "../components/CaseViewToggles";
import { AlgPlaybackModal } from "../components/AlgPlaybackModal";
import { GroupTabs } from "../components/GroupTabs";
import { SubgroupGrid } from "../components/SubgroupGrid";
import type { SessionConfig } from "../types/session";
import type { AlgGroup, AlgorithmCase } from "../types/algorithm";

const TRAINING_CONFIG: SessionConfig = {
  mode: "algorithm",
  startMethod: ["cube-move"],
  stopMethod: ["cube-solved"],
  useInspection: false,
  inspectionSeconds: 15,
};

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
  /** "Show me how" playback for the CURRENT drill case — no need to open the edit modal. */
  const [showPlayback, setShowPlayback] = useState(false);
  const [showCaseAdd, setShowCaseAdd] = useState(false);
  /** When the active group hasSubgroups: null = browsing the folder grid, set = drilled into one subgroup's own case list. */
  const [activeSubgroupId, setActiveSubgroupId] = useState<string | null>(null);
  const groupMeta = getGroupMeta(group);
  const activeSubgroup = groupMeta?.hasSubgroups ? groupMeta.subgroups?.find((s) => s.id === activeSubgroupId) : undefined;
  const isSubgroupHome = Boolean(groupMeta?.hasSubgroups) && !activeSubgroup;
  const moveBuffer = usePendingMoveBuffer(state.phase);

  const reload = () => {
    if (activeSubgroupId) setCases(getSubgroupCases(group, activeSubgroupId));
    else if (groupMeta?.hasSubgroups) setCases([]);
    else setCases(loadAlgGroup(group));
  };

  useEffect(() => {
    setActiveSubgroupId(null);
    const meta = getGroupMeta(group);
    setCases(meta?.hasSubgroups ? [] : loadAlgGroup(group));
    setCaseIdx(0);
    // A manual navigation — moves buffered toward the auto-advanced case
    // don't belong to the group the user just switched to.
    moveBuffer.clear();
  }, [group, moveBuffer]);

  const openSubgroup = (subgroupId: string) => {
    setActiveSubgroupId(subgroupId);
    setCases(getSubgroupCases(group, subgroupId));
    setCaseIdx(0);
    moveBuffer.clear();
  };

  const backToFolders = () => {
    setActiveSubgroupId(null);
    setCases([]);
    setCaseIdx(0);
    moveBuffer.clear();
  };

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
      if (activeSubgroupId) setSubgroupCaseSelected(group, activeSubgroupId, caseName, true);
      else setCaseSelected(group, caseName, true);
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
  const displayConfig = resolveDisplayConfig(groupMeta, activeSubgroup?.displayConfig, currentCase?.displayConfigOverride);

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
    const attempt = {
      time: (state.endTime - state.startTime) / 1000,
      hadErrors: finalProgress?.hadErrors ?? false,
      source: "training" as const,
    };
    if (activeSubgroupId) recordSubgroupAttempt(group, activeSubgroupId, currentCase.name, variant.id, attempt);
    else recordAttempt(group, currentCase.name, variant.id, attempt);
    reload();

    const timer = setTimeout(() => {
      setCaseIdx((i) => (i + 1) % Math.max(selectedCases.length, 1));
      // Force the loading effect even when the next case is the same one
      // (single-case drills / repeats in a short rotation).
      setDrillRound((r) => r + 1);
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.startTime, state.endTime, currentCaseName, variantId, group, activeSubgroupId]);

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

  if (isSubgroupHome) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-1 w-full overflow-x-auto px-4 sm:px-6 py-4">
          <GroupTabs activeId={group} onSelect={setGroup} managementEnabled />
          <div className="ml-auto shrink-0">
            <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
          </div>
        </div>
        <SubgroupGrid
          groupId={group}
          groupDisplayConfig={resolveDisplayConfig(groupMeta)}
          subgroups={groupMeta?.subgroups ?? []}
          onOpen={openSubgroup}
          onChange={reload}
        />
      </div>
    );
  }

  return (
    <>
      <TrainerPanel
        header={
          <div className="flex items-center gap-1 w-full overflow-x-auto">
            {activeSubgroup ? (
              <button onClick={backToFolders} className="btn-secondary text-xs shrink-0">
                <ChevronLeft size={13} /> {activeSubgroup.name}
              </button>
            ) : (
              <GroupTabs activeId={group} onSelect={setGroup} managementEnabled />
            )}
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
              <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white">{currentCase.name}</h2>
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
        controls={
          currentCase && variant ? (
            <button
              onClick={() => setShowPlayback(true)}
              className="btn-secondary text-xs"
              title="Watch this algorithm performed move by move"
            >
              <Video size={13} /> Show me how
            </button>
          ) : undefined
        }
        cubeRef={cubeRef}
        visualization={displayConfig.cubeVisualization}
        {...resolveStickeringProps(displayConfig.stickering)}
        hintFacelets={viewPrefs.backStickers ? "floating" : "none"}
        hintFaceletsElevation={viewPrefs.hintElevation}
        flatCubeRef={flatCubeRef}
        showFlatView={viewPrefs.flatView}
        cubeToolbar={<CaseViewToggles {...viewPrefs} />}
        cameraLatitude={displayConfig.cameraLatitude}
        cameraLongitude={displayConfig.cameraLongitude}
        cubeSetupAlg=""
        timesMs={attemptsForSource(variant?.times ?? [], "training").map((t) => t.time * 1000)}
        statsLabel={currentCase ? `Times — ${currentCase.name}` : "Statistics"}
        showAo12={false}
        bottom={
          <AlgorithmListView
            group={group}
            cases={cases}
            displayConfigOverride={activeSubgroup?.displayConfig}
            onStatusChange={(caseName, variantId, status) => {
              if (activeSubgroupId) setSubgroupLearningStatus(group, activeSubgroupId, caseName, variantId, status);
              else setLearningStatus(group, caseName, variantId, status);
              reload();
            }}
            onSelectedChange={(caseName, selected) => {
              if (activeSubgroupId) setSubgroupCaseSelected(group, activeSubgroupId, caseName, selected);
              else setCaseSelected(group, caseName, selected);
              reload();
            }}
            onSelectAll={(selected, caseNames) => {
              if (activeSubgroupId) setSubgroupSelectedBatch(group, activeSubgroupId, selected, caseNames);
              else setSelectedBatch(group, selected, caseNames);
              reload();
            }}
            onEdit={(case_) => setEditingCase(case_)}
            onPractice={(case_) => practiceNow(case_.name)}
            onAddCase={() => setShowCaseAdd(true)}
          />
        }
      />

      {showPlayback && currentCase && variant && (
        <AlgPlaybackModal
          title={currentCase.name}
          subtitle={variant.name}
          alg={variant.alg}
          {...resolveStickeringProps(displayConfig.stickering)}
          onClose={() => setShowPlayback(false)}
        />
      )}

      {showCaseAdd && (
        <CaseAddModal
          groupId={group}
          existingCategories={Array.from(new Set(cases.map((c) => c.category)))}
          onSave={(newCase) => {
            const added = activeSubgroupId ? addSubgroupCase(group, activeSubgroupId, newCase) : addCase(group, newCase);
            if (!added) return;
            reload();
            setShowCaseAdd(false);
            setEditingCase(newCase);
          }}
          onClose={() => setShowCaseAdd(false)}
        />
      )}

      {editingCase &&
        (() => {
          const editIdx = cases.findIndex((c) => c.name === editingCase.name);
          return (
            <CaseEdit
              // Remount on navigation — CaseEdit's draft state is seeded once
              // from case_, so a prev/next jump must start a fresh draft.
              key={editingCase.name}
              case_={editingCase}
              group={group}
              groupDisplayConfig={resolveDisplayConfig(groupMeta, activeSubgroup?.displayConfig)}
              onSave={(updated) => {
                if (activeSubgroupId) updateSubgroupCase(group, activeSubgroupId, updated);
                else updateCase(group, updated);
                setEditingCase(null);
                reload();
              }}
              onClose={() => setEditingCase(null)}
              onAutoSave={(updated) => {
                if (activeSubgroupId) updateSubgroupCase(group, activeSubgroupId, updated);
                else updateCase(group, updated);
                reload();
              }}
              onDelete={() => {
                if (activeSubgroupId) deleteSubgroupCase(group, activeSubgroupId, editingCase.name);
                else deleteCase(group, editingCase.name);
                setEditingCase(null);
                reload();
              }}
              position={editIdx >= 0 ? { index: editIdx, total: cases.length } : undefined}
              onPrev={editIdx > 0 ? () => setEditingCase(cases[editIdx - 1]) : undefined}
              onNext={editIdx >= 0 && editIdx < cases.length - 1 ? () => setEditingCase(cases[editIdx + 1]) : undefined}
            />
          );
        })()}
    </>
  );
}
