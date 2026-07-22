/**
 * AttackPage — OLL/PLL Attack: execute every case in a group, in a
 * reorderable queue, timing each and the whole session.
 *
 * Same session reducer as TrainingPage (mode: "attack") — the only
 * difference in reducer terms is which store the result is saved to.
 * Queue advancement and session totals are page-level concerns, not
 * reducer concerns (matches plan.md §6.1: mode only changes what target
 * populates the tracker and where the result is persisted).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCcw, ChevronRight, ChevronLeft, Video } from "lucide-react";
import { SessionProvider, useSession } from "../state/sessionContext";
import { selectCurrentProgress } from "../state/sessionSelectors";
import { buildSequenceTarget, computeSequenceProgress } from "../logic/sequenceTracker";
import { invertSequence } from "../logic/moveParser";
import { getDefaultVariant } from "../logic/algGroupConfig";
import {
  getGroupMeta,
  resolveDisplayConfig,
  resolveStickeringProps,
  getSubgroupCases,
  recordSubgroupAttempt,
  updateSubgroupCase,
} from "../services/algGroupRegistry";
import { loadAlgGroup, recordAttempt, updateCase } from "../services/algorithmStore";
import { saveAttackSession, getAttackSessions, type AttackSession } from "../services/attackStore";
import { useSmartCube } from "../hooks/useSmartCube";
import { useAnimationTimer } from "../hooks/useAnimationTimer";
import { useMaskMoves } from "../hooks/useMaskMoves";
import { usePendingMoveBuffer } from "../hooks/usePendingMoveBuffer";
import { useCaseViewPrefs } from "../hooks/useCaseViewPrefs";
import { useCubeViewRefs } from "../hooks/useCubeViewRefs";
import { TrainerPanel } from "../components/TrainerPanel";
import { ConnectionPanel } from "../components/ConnectionPanel";
import { CaseListItem } from "../components/CaseListItem";
import { CaseEdit } from "../components/CaseEdit";
import { CaseViewToggles } from "../components/CaseViewToggles";
import { AlgPlaybackModal } from "../components/AlgPlaybackModal";
import { GroupTabs } from "../components/GroupTabs";
import { SubgroupCard } from "../components/SubgroupCard";
import type { SessionConfig } from "../types/session";
import type { AlgGroup, AlgorithmCase, DisplayConfig } from "../types/algorithm";
import { formatTimeMs } from "../logic/statistics";

const ATTACK_CONFIG: SessionConfig = {
  mode: "attack",
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
 * User's preferred queue order, per group — captured on every drag and
 * reapplied whenever the queue is (re)built. Stored as the full list of
 * case names; cases added since the save are appended in default order,
 * renamed/removed ones silently drop out.
 */
function orderStorageKey(group: AlgGroup): string {
  return `nact_attack_order_${group}`;
}

function applyStoredOrder(group: AlgGroup, names: string[]): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(orderStorageKey(group)) ?? "null");
    if (!Array.isArray(stored)) return names;
    const known = stored.filter((n): n is string => typeof n === "string" && names.includes(n));
    const rest = names.filter((n) => !known.includes(n));
    return [...known, ...rest];
  } catch {
    return names;
  }
}

function saveStoredOrder(group: AlgGroup, order: string[]) {
  localStorage.setItem(orderStorageKey(group), JSON.stringify(order));
}

export default function AttackPage() {
  return (
    <SessionProvider config={ATTACK_CONFIG}>
      <AttackPageInner />
    </SessionProvider>
  );
}

function AttackPageInner() {
  const { state, submitCubeMove, setTarget, reset } = useSession();
  const { cubeRef, flatCubeRef, view } = useCubeViewRefs();
  const { maskMoves, toggleMaskMoves } = useMaskMoves();

  const [group, setGroup] = useState<AlgGroup>("oll");
  const viewPrefs = useCaseViewPrefs(group.startsWith("f2l"), "attack");
  /** When the active group hasSubgroups: null = browsing the folder grid, set = drilled into one subgroup's own queue. */
  const [activeSubgroupId, setActiveSubgroupId] = useState<string | null>(null);
  const groupMeta = getGroupMeta(group);
  const activeSubgroup = groupMeta?.hasSubgroups ? groupMeta.subgroups?.find((s) => s.id === activeSubgroupId) : undefined;
  const isSubgroupHome = Boolean(groupMeta?.hasSubgroups) && !activeSubgroup;
  const displayConfig = resolveDisplayConfig(groupMeta, activeSubgroup?.displayConfig);
  // Sessions/queue-order are stored per (group, subgroup) — attackStore just
  // uses this as an opaque localStorage key suffix, no registry lookup.
  const sessionKey = activeSubgroupId ? `${group}:${activeSubgroupId}` : group;
  const loadCases = () => (activeSubgroupId ? getSubgroupCases(group, activeSubgroupId) : loadAlgGroup(group));
  const [cases, setCases] = useState<AlgorithmCase[]>(() => loadCases());
  const [queue, setQueue] = useState<string[]>(() => applyStoredOrder(sessionKey, cases.map((c) => c.name)));
  const [completed, setCompleted] = useState<{ caseName: string; timeMs: number }[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [history, setHistory] = useState<AttackSession[]>(() => getAttackSessions(sessionKey));
  const [editingCase, setEditingCase] = useState<AlgorithmCase | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  /** "Show me how" playback for the current queue case — no need to open the editor. */
  const [showPlayback, setShowPlayback] = useState(false);
  // Bumped by Restart so the case-arming effect below re-runs even when the
  // restarted queue's first case happens to be the SAME one already active
  // (e.g. restarting right after a wrong move, before ever advancing) —
  // keying only on variant?.id would otherwise skip re-arming, leaving the
  // stale UNDO correction stack and the mid-mistake cube view in place.
  const [restartToken, setRestartToken] = useState(0);
  /**
   * The just-completed session's result — shown as a "Session Complete!"
   * banner WITHOUT blocking the next one: the queue refills and the first
   * case arms immediately (see the completion effect below), so the app is
   * ready to attack again right away. Cleared the moment the user actually
   * starts that next attempt (phase -> "active"), same dismiss pattern as
   * SolvePage's inline summary.
   */
  const [justFinished, setJustFinished] = useState<{
    totalMs: number;
    caseTimes: { caseName: string; timeMs: number }[];
  } | null>(null);
  const moveBuffer = usePendingMoveBuffer(state.phase);

  const armSession = (key: string, loaded: AlgorithmCase[]) => {
    setCases(loaded);
    setQueue(applyStoredOrder(key, loaded.map((c) => c.name)));
    setCompleted([]);
    setSessionStartTime(null);
    setJustFinished(null);
    setHistory(getAttackSessions(key));
    setExpandedSessionId(null);
    moveBuffer.clear(); // manual navigation — buffered moves belonged to the old queue
  };

  useEffect(() => {
    setActiveSubgroupId(null);
    const meta = getGroupMeta(group);
    armSession(group, meta?.hasSubgroups ? [] : loadAlgGroup(group));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  const openSubgroup = (subgroupId: string) => {
    setActiveSubgroupId(subgroupId);
    armSession(`${group}:${subgroupId}`, getSubgroupCases(group, subgroupId));
  };

  const backToFolders = () => {
    setActiveSubgroupId(null);
    armSession(group, []);
  };

  const currentCase = useMemo(() => cases.find((c) => c.name === queue[0]) ?? null, [cases, queue]);
  const variant = currentCase ? getDefaultVariant(currentCase) : undefined;

  useEffect(() => {
    if (!variant) return;
    reset();
    setTarget(variant.alg);
    view.reset();
    const inv = invertAlg(variant.alg);
    if (inv) view.setSetupAlgorithm(inv, "");
    // Moves that arrived while the previous case was completing (the queue
    // advances over a render — a fast solver's first moves of the NEXT case
    // can land in that gap) belong to this case: replay them, stopping if
    // they complete it (any tail waits for the case after).
    const flushTarget = buildSequenceTarget(variant.alg);
    const delivered: string[] = [];
    moveBuffer.flush((move, timestamp) => {
      submitCubeMove(move, timestamp);
      view.addMove(move);
      delivered.push(move);
      return !computeSequenceProgress(flushTarget, delivered).isCompleted;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant?.id, restartToken]);

  const cube = useSmartCube({
    onMove: (move, timestamp) => {
      // While the edit modal is open, moves belong to IT (its VariantTest
      // popup runs its own listener/session) — feeding them into the attack
      // underneath would advance it (or even start the session timer) unnoticed.
      if (editingCase) return;
      if (sessionStartTime === null) setSessionStartTime(timestamp);
      // Between a case completing and the next target arming, the session
      // would DROP moves — capture them for replay instead.
      if (moveBuffer.capture(move, timestamp)) return;
      submitCubeMove(move, timestamp);
      view.addMove(move);
    },
  });

  // Attack measures the WHOLE session, not each case individually — the
  // timer runs continuously from the first move of the first case until the
  // last case is completed. sessionStartTime nulls out the instant the
  // queue refills (see the completion effect), which would otherwise snap
  // this straight to 0.000 before the solver has even seen their total —
  // held on the finished total instead (same lifetime as justFinished /
  // the results list below) until they actually move on.
  const rawSessionElapsedSec = useAnimationTimer(sessionStartTime, null, sessionStartTime !== null);
  const sessionElapsedSec = justFinished ? justFinished.totalMs / 1000 : rawSessionElapsedSec;

  // Guarded by attempt identity (endTime) — see TrainingPage's comment: a
  // buffered replay can complete a case within one batched render, so a
  // boolean re-armed by a non-"done" phase would miss it.
  const lastRecordedEndRef = useRef<number | null>(null);
  useEffect(() => {
    if (state.phase !== "done") return;
    if (!currentCase || !variant || state.startTime === null || state.endTime === null) return;
    if (lastRecordedEndRef.current === state.endTime) return;
    lastRecordedEndRef.current = state.endTime;

    const timeMs = state.endTime - state.startTime;
    const attempt = { time: timeMs / 1000, hadErrors: false, source: "attack" as const };
    if (activeSubgroupId) recordSubgroupAttempt(group, activeSubgroupId, currentCase.name, variant.id, attempt);
    else recordAttempt(group, currentCase.name, variant.id, attempt);
    const loadedCases = loadCases();
    setCases(loadedCases);

    const newCompleted = [...completed, { caseName: currentCase.name, timeMs }];
    const newQueue = queue.slice(1);

    if (newQueue.length > 0 || sessionStartTime === null) {
      setCompleted(newCompleted);
      setQueue(newQueue);
      return;
    }

    // Last case of the session just landed — save it, then immediately
    // requeue so the next attack is armed right away (no manual Restart).
    // The just-finished summary is shown separately and self-dismisses on
    // the first move of the new attempt.
    saveAttackSession({
      id: crypto.randomUUID(),
      date: Date.now(),
      group: sessionKey,
      totalMs: state.endTime - sessionStartTime,
      caseTimes: newCompleted,
    });
    setHistory(getAttackSessions(sessionKey));
    setJustFinished({ totalMs: state.endTime - sessionStartTime, caseTimes: newCompleted });
    setQueue(applyStoredOrder(sessionKey, loadedCases.map((c) => c.name)));
    setCompleted([]);
    setSessionStartTime(null);
    moveBuffer.clear(); // fiddling right after completion doesn't belong to the fresh queue
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.startTime, state.endTime]);

  // Dismiss the completion banner the moment the user actually starts the
  // next attempt (attack/algorithm mode jumps straight setup -> active on
  // the first move — there's no "setup phase with moves logged" middle
  // state to key off, unlike SolvePage's scramble tracking).
  useEffect(() => {
    if (justFinished && state.phase === "active") setJustFinished(null);
  }, [justFinished, state.phase]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setQueue((items) => {
        const next = arrayMove(items, items.indexOf(active.id as string), items.indexOf(over.id as string));
        // Persist the FULL order: mid-session the queue is missing the
        // already-completed cases — keep them at the front (in play order)
        // so they don't vanish from the saved arrangement.
        saveStoredOrder(sessionKey, [...completed.map((c) => c.caseName), ...next]);
        return next;
      });
    }
  }

  function handleRestart() {
    armSession(sessionKey, loadCases());
    setRestartToken((t) => t + 1); // force a full re-arm (target, UNDO stack, cube view) even on a same-case restart
  }

  const progress = selectCurrentProgress(state);
  const targetTokens = variant ? variant.alg.trim().split(/\s+/).filter(Boolean) : [];
  // `completed` itself resets to [] the instant the queue refills (it has
  // to, so the NEW session's own progress starts counting from zero — see
  // the completion effect). What's actually SHOWN (header counter + the
  // per-case breakdown below the queue) keeps the just-finished session's
  // results up instead, for exactly as long as justFinished is held.
  const displayedCompleted = justFinished ? justFinished.caseTimes : completed;
  // True only when the group genuinely has no cases to attack (e.g. every
  // case deselected/deleted) — a finished session no longer lands here,
  // since the completion effect refills the queue immediately.
  const noCases = cases.length === 0;

  // "Attack times" tracks the full-execution total per past session
  // (oldest -> newest), not individual case times within the current run —
  // that's what the per-case list below the queue is for.
  const sessionTotalsMs = useMemo(() => [...history].sort((a, b) => a.date - b.date).map((s) => s.totalMs), [history]);

  const timerState: "idle" | "solving" | "solved" =
    justFinished ? "solved" : state.phase === "active" ? "solving" : "idle";

  if (isSubgroupHome) {
    const attackSubgroups = (groupMeta?.subgroups ?? []).filter((sg) => sg.availableInAttack === true);
    return (
      <>
        <div className="w-full overflow-x-auto px-4 sm:px-6 py-4">
          <GroupTabs
            activeId={group}
            onSelect={setGroup}
            attackContext
            rightSlot={<ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />}
          />
        </div>
        <div className="px-4 sm:px-6 pb-10">
          {attackSubgroups.length === 0 && (
            <p className="text-sm text-gray-600">
              No subgroups of {groupMeta?.name} are available in Attack yet — enable one from its settings on the Practice tab.
            </p>
          )}
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" }}>
            {attackSubgroups.map((sg) => (
              <SubgroupCard
                key={sg.id}
                subgroup={sg}
                groupDisplayConfig={resolveDisplayConfig(groupMeta)}
                onOpen={() => openSubgroup(sg.id)}
              />
            ))}
          </div>
        </div>
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
            <span className="ml-auto text-xs text-gray-500 tabular-nums font-mono shrink-0">
              {displayedCompleted.length} / {cases.length}
            </span>
            <div className="shrink-0">
              <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
            </div>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <GroupTabs
              activeId={group}
              onSelect={setGroup}
              attackContext
              rightSlot={
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 tabular-nums font-mono shrink-0">
                    {displayedCompleted.length} / {cases.length}
                  </span>
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
      loadingText={noCases ? "No cases selected" : undefined}
      completeText="Algorithm complete!"
      centerTop={
        <div className="flex flex-col items-center gap-1 text-center">
          {justFinished && (
            <div className="flex flex-col items-center gap-0.5 mb-1">
              <p className="text-sm font-semibold text-emerald-400">
                Session complete! ({justFinished.caseTimes.length} case{justFinished.caseTimes.length === 1 ? "" : "s"})
              </p>
              <p className="text-xs text-gray-500 font-mono tabular-nums">Total: {formatTimeMs(justFinished.totalMs)}</p>
            </div>
          )}
          {currentCase && (
            <>
              <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white">{currentCase.name}</h2>
              <p className="text-xs text-gray-500">{currentCase.category}</p>
            </>
          )}
        </div>
      }
      timeMs={sessionElapsedSec * 1000}
      timerState={timerState}
      hintText={state.phase === "setup" ? "Make a move to start" : null}
      controls={
        <div className="flex items-center gap-2">
          {currentCase && variant && (
            <button
              onClick={() => setShowPlayback(true)}
              className="btn-secondary text-xs"
              title="Watch this algorithm performed move by move"
            >
              <Video size={13} /> Show me how
            </button>
          )}
          <button onClick={handleRestart} className="btn-secondary">
            <RotateCcw size={13} /> Restart
          </button>
        </div>
      }
      cubeRef={cubeRef}
      visualization="3D"
      {...resolveStickeringProps(displayConfig.stickering)}
      hintFacelets={viewPrefs.backStickers ? "floating" : "none"}
      hintFaceletsElevation={viewPrefs.hintElevation}
      flatCubeRef={flatCubeRef}
      showFlatView={viewPrefs.flatView}
      cubeToolbar={<CaseViewToggles {...viewPrefs} />}
      cameraLatitude={displayConfig.cameraLatitude}
      cameraLongitude={displayConfig.cameraLongitude}
      cubeSetupAlg=""
      timesMs={sessionTotalsMs}
      statsLabel="Attack times"
      showAo12={false}
      bottom={
        <div className="flex flex-col min-h-0">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={queue} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-gray-800/40">
                {queue.map((name, i) => {
                  const c = cases.find((x) => x.name === name);
                  if (!c) return null;
                  return (
                    <SortableQueueItem
                      key={name}
                      id={name}
                      case_={c}
                      groupDisplayConfig={displayConfig}
                      isActive={i === 0}
                      onEdit={() => setEditingCase(c)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
          {displayedCompleted.length > 0 && (
            <div className="divide-y divide-gray-800/40 border-t border-gray-800">
              {[...displayedCompleted].reverse().map((entry) => (
                <div key={entry.caseName} className="flex items-center gap-3 px-4 py-2 text-gray-600">
                  <span className="flex-1 text-xs truncate">{entry.caseName}</span>
                  <span className="text-xs font-mono tabular-nums">{formatTimeMs(entry.timeMs)}</span>
                </div>
              ))}
            </div>
          )}
          {history.length > 0 && (
            <div className="border-t border-gray-800">
              <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Recent {groupMeta?.name ?? group} attack sessions
              </div>
              <div className="divide-y divide-gray-800/40">
                {[...history]
                  .sort((a, b) => b.date - a.date)
                  .slice(0, 10)
                  .map((s) => {
                    const isExpanded = expandedSessionId === s.id;
                    return (
                      <div key={s.id}>
                        <button
                          onClick={() => setExpandedSessionId(isExpanded ? null : s.id)}
                          className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.03] transition-colors"
                        >
                          <ChevronRight size={11} className={`shrink-0 text-gray-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          <span className="flex-1 text-xs text-gray-500">
                            {new Date(s.date).toLocaleDateString()} {new Date(s.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="text-[10px] text-gray-700">{s.caseTimes.length} cases</span>
                          <span className="text-xs font-mono tabular-nums text-gray-300">{formatTimeMs(s.totalMs)}</span>
                        </button>
                        {isExpanded && (
                          <div className="pl-8 pr-4 pb-2 divide-y divide-gray-800/30">
                            {s.caseTimes.map((c, i) => (
                              <div key={`${c.caseName}-${i}`} className="flex items-center gap-3 py-1.5">
                                <span className="flex-1 text-[11px] text-gray-500 truncate">{c.caseName}</span>
                                <span className="text-[11px] font-mono tabular-nums text-gray-400">{formatTimeMs(c.timeMs)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
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

    {editingCase &&
      (() => {
        const editIdx = cases.findIndex((c) => c.name === editingCase.name);
        return (
          <CaseEdit
            // Remount on navigation — see TrainingPage's identical usage.
            key={editingCase.name}
            case_={editingCase}
            group={group}
            groupDisplayConfig={displayConfig}
            onSave={(updated) => {
              if (activeSubgroupId) updateSubgroupCase(group, activeSubgroupId, updated);
              else updateCase(group, updated);
              setEditingCase(null);
              setCases(loadCases());
            }}
            onClose={() => setEditingCase(null)}
            onAutoSave={(updated) => {
              if (activeSubgroupId) updateSubgroupCase(group, activeSubgroupId, updated);
              else updateCase(group, updated);
              setCases(loadCases());
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

function SortableQueueItem({
  id,
  case_,
  groupDisplayConfig,
  isActive,
  onEdit,
}: {
  id: string;
  case_: AlgorithmCase;
  groupDisplayConfig: DisplayConfig;
  isActive: boolean;
  onEdit?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CaseListItem
        case_={case_}
        groupDisplayConfig={groupDisplayConfig}
        statsSource="attack"
        isActive={isActive}
        onEdit={onEdit}
        left={
          <button
            {...attributes}
            {...listeners}
            className="pl-4 py-2.5 text-gray-700 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical size={14} />
          </button>
        }
      />
    </div>
  );
}
