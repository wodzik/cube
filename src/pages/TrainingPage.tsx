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
import { Video, ChevronLeft, ListChecks, RotateCcw, Compass } from "lucide-react";
import { SessionProvider, useSession } from "../state/sessionContext";
import { selectCurrentProgress, selectMoveCount } from "../state/sessionSelectors";
import { buildSequenceTarget, computeSequenceProgress } from "../logic/sequenceTracker";
import { invertSequence, finalOrientationAfterAlg, identityOrientation } from "../logic/moveParser";
import type { Orientation } from "../types/cube";
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

/**
 * Per-group override for center-orientation tracking (localStorage key
 * `nact_centers_tracking_${group}`) — "true"/"false" if the user has
 * explicitly toggled it for this group, otherwise falls back to the
 * group's own category (on for Roux, off elsewhere, since only Roux's
 * M/E/S-heavy algorithms leave centers rotated).
 */
function trackingStorageKey(group: AlgGroup): string {
  return `nact_centers_tracking_${group}`;
}
function loadTrackingEnabled(group: AlgGroup, defaultOn: boolean): boolean {
  const raw = localStorage.getItem(trackingStorageKey(group));
  if (raw === "true") return true;
  if (raw === "false") return false;
  return defaultOn;
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

  const [group, setGroup] = useState<AlgGroup>("f2l");
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

  // Center-orientation tracking (M/E/S-heavy Roux algorithms rotate U/F/D/B
  // as a group even when correctly performed). Computed PURELY from
  // completed algorithms' own known text (moveParser's
  // finalOrientationAfterAlg — pure math, no kpuzzle, no live hardware-move
  // accumulation: an earlier version inferred orientation from accumulated
  // hardware moves, which is fragile since this page never verifies actual
  // cube state, and was reverted after it broke move recognition).
  //
  // Feeds ONLY the SESSION'S target — passed as setTarget's
  // initialOrientation, so the NEXT algorithm's own letters are resolved
  // against the hardware frame the previous algorithm left behind. Without
  // this, a solver who doesn't regrip between back-to-back algorithms gets
  // misrecognized: e.g. "M M' M'" nets to one M' (leaves the frame
  // x-shifted), and the following algorithm's own "U" would otherwise be
  // checked against a fresh identity frame that no longer matches physical
  // reality. Deliberately does NOT feed the DISPLAY (the case setup shown
  // is always canonical — see the case-loading effect below) — an earlier
  // version also rotated the setup to match, but that broke the mask
  // overlay's alignment and showed a different picture than the case card.
  const [trackingEnabled, setTrackingEnabled] = useState(() => loadTrackingEnabled(group, groupMeta?.category === "Roux"));
  const trackingEnabledRef = useRef(trackingEnabled);
  trackingEnabledRef.current = trackingEnabled;
  const [accumulatedOrientation, setAccumulatedOrientation] = useState<Orientation>(identityOrientation);
  const accumulatedOrientationRef = useRef(accumulatedOrientation);
  accumulatedOrientationRef.current = accumulatedOrientation;

  const toggleTracking = () => {
    const next = !trackingEnabled;
    setTrackingEnabled(next);
    localStorage.setItem(trackingStorageKey(group), String(next));
    setAccumulatedOrientation(identityOrientation());
    setDrillRound((r) => r + 1); // redisplay the current case immediately under the new setting
  };

  /** Declare the physical cube's orientation canonical again (Resync). */
  const resyncOrientation = () => {
    setAccumulatedOrientation(identityOrientation());
    setDrillRound((r) => r + 1); // force the current case's setup to redisplay without the (now-cleared) rotation
  };

  /**
   * Abandon the current attempt and restart the SAME case from scratch —
   * bumping drillRound re-runs the case-loading effect below exactly as it
   * does on auto-advance (reset() the session, re-arm setTarget, view.reset()
   * + re-apply the setup algorithm), just without moving to the next case.
   * Clearing moveBuffer first covers the edge case of resetting right as a
   * just-completed attempt's moves are still in its "done"-phase capture
   * window — those belong to the abandoned attempt, not the fresh one.
   */
  const resetAttempt = () => {
    moveBuffer.clear();
    setDrillRound((r) => r + 1);
  };

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
    setTrackingEnabled(loadTrackingEnabled(group, meta?.category === "Roux"));
    setAccumulatedOrientation(identityOrientation());
    // A manual navigation — moves buffered toward the auto-advanced case
    // don't belong to the group the user just switched to.
    moveBuffer.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /** The algorithm's own tokens, exactly as written — fed to the view one at a time as each completes (see the animation effect below), never the raw decomposed hardware sub-moves. */
  const algTokens = useMemo(() => (variant ? variant.alg.trim().split(/\s+/).filter(Boolean) : []), [variant?.id]);
  /** Highest completed-token index already animated onto the view this attempt. */
  const animatedTokenIndexRef = useRef(-1);

  // Load the case's algorithm as the target, and pre-set the cube to its
  // scrambled state, whenever the case (or its variant) changes — or the
  // drill advances to another round of the SAME case (drillRound).
  useEffect(() => {
    if (!variant) return;
    reset();
    const initialOrientation = trackingEnabled ? accumulatedOrientation : undefined;
    setTarget(variant.alg, initialOrientation);
    view.reset();
    animatedTokenIndexRef.current = -1;
    // Always the case's own canonical setup, matching the case card and
    // giving the user a CONSISTENT picture to recognize the pattern from —
    // never rotated by accumulated drift. That drift is real (the user's
    // physical cube's centers may not be canonical), but it belongs ONLY in
    // setTarget's initialOrientation above (recognizing their un-regripped
    // moves correctly); rotating the SETUP too made the mask overlay (which
    // assumes a canonical setup — see trainerMasks.ts) render misaligned,
    // and the drill's whole point is recognizing the pattern, not mirroring
    // whatever orientation the physical cube happens to be in right now.
    const inv = invertAlg(variant.alg);
    if (inv) view.setSetupAlgorithm(inv, "");
    // Moves made while the previous attempt was finishing up (phase "done",
    // e.g. chaining the next execution immediately) belong to THIS attempt —
    // replay them now that the target is armed, stopping if they complete it
    // (any tail beyond completion waits for the round after). Must use the
    // SAME initialOrientation as the real target above, or this check would
    // silently disagree with what the session actually armed.
    const flushTarget = buildSequenceTarget(variant.alg, initialOrientation);
    const delivered: string[] = [];
    moveBuffer.flush((move, timestamp) => {
      submitCubeMove(move, timestamp);
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
      // The VISUAL cube is driven separately, by logical token completion
      // (see the effect below) — NOT by forwarding this raw hardware move
      // directly. See that effect's comment for why.
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

    // Carry the just-completed algorithm's OWN net hardware-frame shift
    // forward — both for the next case's setup display AND (critically) for
    // setTarget's initialOrientation, so the next algorithm's own letters
    // are resolved against wherever this one left the frame, not a fresh
    // identity assumption. Derived purely from variant.alg's known text
    // (never from the raw moveLog — any wrong-move detours cancel with
    // their own corrections, so a completed attempt's net effect always
    // matches variant.alg's exactly, error or not) — deterministic, no
    // dependency on live hardware-move accumulation.
    if (trackingEnabledRef.current) {
      accumulatedOrientationRef.current = finalOrientationAfterAlg(variant.alg, accumulatedOrientationRef.current);
      setAccumulatedOrientation(accumulatedOrientationRef.current);
    }

    // Short, not zero: long enough for the final move's cube animation to
    // actually finish playing (tempoScale=5 on CubeVisualisation puts a
    // single-move animation at roughly this order of magnitude) before
    // view.reset() cuts it off for the next case — any moves the user
    // fires during this window are still captured by moveBuffer and
    // replayed once the next target arms, so shortening this further
    // couldn't drop anything even for a very fast chained solver.
    const timer = setTimeout(() => {
      setCaseIdx((i) => (i + 1) % Math.max(selectedCases.length, 1));
      // Force the loading effect even when the next case is the same one
      // (single-case drills / repeats in a short rotation).
      setDrillRound((r) => r + 1);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.startTime, state.endTime, currentCaseName, variantId, group, activeSubgroupId]);

  const progress = selectCurrentProgress(state);
  const moveCount = selectMoveCount(state);
  const targetTokens = variant ? variant.alg.trim().split(/\s+/).filter(Boolean) : [];

  // Drive the VISUAL cube by completed LOGICAL TOKENS, never by forwarding
  // raw hardware moves directly (as the onMove handler used to). Two
  // reasons, both confirmed by direct kpuzzle verification:
  //  1. The physical smart cube reports M/E/S as their DECOMPOSED
  //     outer-face sub-moves (e.g. M' fires R' then L — see moveParser's
  //     SLICE_CONFIG) — animating those literally moves the WRONG pieces
  //     (a real R/L turn, not a slice turn) and never touches centers.
  //  2. An earlier fix animated the raw sub-moves AND separately inserted
  //     a compensating rotation once each token completed — this looked
  //     right for a single isolated token, but the recognition fix (that
  //     the SAME token's compensating rotation was already needed for)
  //     means EVERY SUBSEQUENT token's raw hardware letter is ALSO already
  //     computed relative to the shifted frame (see algToPhysicalMoves) —
  //     so applying that shifted letter on top of an ALREADY explicitly
  //     rotated view double-counts the shift, corrupting the display more
  //     with every slice/wide token (verified live: a fully, correctly
  //     recognized "2 Top 2 Bot" left the cube visibly NOT solved).
  // Feeding the algorithm's own token text directly sidesteps both: it's
  // exactly what kpuzzle's own move definitions do (verified — trivially
  // correct, no decomposition/recomposition involved), so it can't diverge
  // from the target's own true effect no matter how many tokens chain.
  // Applies UNCONDITIONALLY (not gated by the Centers toggle) — this is a
  // general animation-correctness fix, not cross-case orientation tracking.
  //
  // Deliberately NOT keyed on `progress` above: selectCurrentProgress only
  // returns non-null during "setup"/"active" (see sessionSelectors.ts) —
  // the render where the FINAL move completes the algorithm is exactly the
  // render where phase flips to "done", at which point progress is ALREADY
  // null. That render never re-fires this effect with the final token
  // included, so the last move's animation was silently dropped every
  // time — recompute progress directly from moveLog here, unaffected by
  // that phase gate (state.target/state.moveLog stay valid through "done").
  const liveProgress = useMemo(
    () => (state.target ? computeSequenceProgress(state.target, state.moveLog.map((m) => m.move)) : null),
    [state.target, state.moveLog]
  );
  useEffect(() => {
    if (!liveProgress) return;
    let maxIdx = animatedTokenIndexRef.current;
    for (const idx of liveProgress.completedIndices) {
      if (idx <= animatedTokenIndexRef.current) continue;
      const token = algTokens[idx];
      if (token) view.addMove(token);
      if (idx > maxIdx) maxIdx = idx;
    }
    animatedTokenIndexRef.current = maxIdx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveProgress?.completedCount]);

  const timerState: "idle" | "solving" | "solved" =
    state.phase === "active" ? "solving" : state.phase === "done" ? "solved" : "idle";

  const hintText = !currentCase
    ? "Select cases below to begin practicing"
    : state.phase === "setup"
      ? "Make a move to start"
      : state.phase === "done"
        ? `${moveCount} moves`
        : null;

  const orientationControls = (
    <>
      <button
        onClick={toggleTracking}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
          trackingEnabled ? "text-emerald-300 bg-emerald-500/10" : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"
        }`}
        title="Track cube orientation across algorithms with net whole-cube rotation (Roux M/E/S) and show the case setup rotated to match"
      >
        <Compass size={12} /> Centers
      </button>
      {trackingEnabled && (
        <button
          onClick={resyncOrientation}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] transition-colors"
          title="My physical cube's orientation is canonical again — reset tracking"
        >
          <RotateCcw size={12} /> Resync
        </button>
      )}
    </>
  );

  if (isSubgroupHome) {
    return (
      <>
        <div className="w-full overflow-x-auto px-4 sm:px-6 py-4">
          <GroupTabs
            activeId={group}
            onSelect={setGroup}
            managementEnabled
            rightSlot={
              <div className="flex items-center gap-2">
                {orientationControls}
                <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
              </div>
            }
          />
        </div>
        <SubgroupGrid
          groupId={group}
          groupDisplayConfig={resolveDisplayConfig(groupMeta)}
          subgroups={groupMeta?.subgroups ?? []}
          onOpen={openSubgroup}
          onChange={reload}
        />
      </>
    );
  }

  return (
    <>
      <TrainerPanel
        header={
          activeSubgroup ? (
            <div className="flex items-center gap-1 w-full overflow-x-auto">
              <button onClick={backToFolders} className="btn-secondary text-xs shrink-0">
                <ChevronLeft size={13} /> {activeSubgroup.name}
              </button>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {orientationControls}
                <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
              </div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <GroupTabs
                activeId={group}
                onSelect={setGroup}
                managementEnabled
                rightSlot={
                  <div className="flex items-center gap-2">
                    {orientationControls}
                    <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
                  </div>
                }
              />
            </div>
          )
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
            <div className="flex items-center gap-2">
              <button
                onClick={resetAttempt}
                className="btn-secondary text-xs"
                title="Restart this case from the beginning"
              >
                <RotateCcw size={13} /> Reset
              </button>
              <button
                onClick={() => setShowPlayback(true)}
                className="btn-secondary text-xs"
                title="Watch this algorithm performed move by move"
              >
                <Video size={13} /> Show me how
              </button>
            </div>
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
        cubeOverlay={
          !currentCase ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <ListChecks size={20} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-400">Select cases below to begin practicing</span>
            </div>
          ) : undefined
        }
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
