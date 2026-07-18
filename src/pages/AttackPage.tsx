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
import { GripVertical, RotateCcw, ChevronRight } from "lucide-react";
import { SessionProvider, useSession } from "../state/sessionContext";
import { selectCurrentProgress } from "../state/sessionSelectors";
import { buildSequenceTarget, computeSequenceProgress } from "../logic/sequenceTracker";
import { invertSequence } from "../logic/moveParser";
import { getDefaultVariant, STICKERING, CAMERA } from "../logic/algGroupConfig";
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
import type { SessionConfig } from "../types/session";
import type { AlgGroup, AlgorithmCase } from "../types/algorithm";
import { formatTimeMs } from "../logic/statistics";

const ATTACK_CONFIG: SessionConfig = {
  mode: "attack",
  startMethod: ["cube-move"],
  stopMethod: ["cube-solved"],
  useInspection: false,
  inspectionSeconds: 15,
};

// Top-level pick: OLL and PLL are groups directly; "F2L" fans out into a
// slot sub-picker (each slot is its own 41-case AlgGroup with independent
// queue, stats, and session history).
const ATTACK_TABS: { id: "oll" | "pll" | "f2l"; label: string }[] = [
  { id: "oll", label: "OLL" },
  { id: "pll", label: "PLL" },
  { id: "f2l", label: "F2L" },
];

const F2L_SLOTS: { id: AlgGroup; label: string; title: string }[] = [
  { id: "f2l-front-right", label: "FR", title: "Front-right slot" },
  { id: "f2l-front-left", label: "FL", title: "Front-left slot" },
  { id: "f2l-back-right", label: "BR", title: "Back-right slot" },
  { id: "f2l-back-left", label: "BL", title: "Back-left slot" },
];

const GROUP_LABELS: Partial<Record<AlgGroup, string>> = {
  oll: "OLL",
  pll: "PLL",
  "f2l-front-right": "F2L Front-Right",
  "f2l-front-left": "F2L Front-Left",
  "f2l-back-right": "F2L Back-Right",
  "f2l-back-left": "F2L Back-Left",
};

function invertAlg(alg: string): string {
  const moves = alg.trim().split(/\s+/).filter(Boolean);
  return moves.length === 0 ? "" : invertSequence(moves).join(" ");
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
  // Remembered so toggling away from F2L and back returns to the same slot.
  const [f2lSlot, setF2lSlot] = useState<AlgGroup>("f2l-front-right");
  const [cases, setCases] = useState<AlgorithmCase[]>(() => loadAlgGroup(group));
  const [queue, setQueue] = useState<string[]>(() => cases.map((c) => c.name));
  const [completed, setCompleted] = useState<{ caseName: string; timeMs: number }[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [history, setHistory] = useState<AttackSession[]>(() => getAttackSessions(group));
  const [editingCase, setEditingCase] = useState<AlgorithmCase | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const moveBuffer = usePendingMoveBuffer(state.phase);

  useEffect(() => {
    const loaded = loadAlgGroup(group);
    setCases(loaded);
    setQueue(loaded.map((c) => c.name));
    setCompleted([]);
    setSessionStartTime(null);
    setHistory(getAttackSessions(group));
    setExpandedSessionId(null);
    moveBuffer.clear(); // manual navigation — buffered moves belonged to the old group's queue
  }, [group, moveBuffer]);

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
  }, [variant?.id]);

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
  // last case is completed, never resetting between cases.
  const sessionElapsedSec = useAnimationTimer(
    sessionStartTime,
    state.phase === "done" && queue.length <= 1 ? state.endTime : null,
    sessionStartTime !== null
  );

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
    recordAttempt(group, currentCase.name, variant.id, { time: timeMs / 1000, hadErrors: false, source: "attack" });
    setCases(loadAlgGroup(group));

    const newCompleted = [...completed, { caseName: currentCase.name, timeMs }];
    const newQueue = queue.slice(1);
    setCompleted(newCompleted);
    setQueue(newQueue);

    if (newQueue.length === 0 && sessionStartTime !== null) {
      saveAttackSession({
        id: crypto.randomUUID(),
        date: Date.now(),
        group,
        totalMs: state.endTime - sessionStartTime,
        caseTimes: newCompleted,
      });
      setHistory(getAttackSessions(group));
    }
  }, [state.phase, state.startTime, state.endTime]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setQueue((items) => arrayMove(items, items.indexOf(active.id as string), items.indexOf(over.id as string)));
    }
  }

  function handleRestart() {
    const loaded = loadAlgGroup(group);
    setCases(loaded);
    setQueue(loaded.map((c) => c.name));
    setCompleted([]);
    setSessionStartTime(null);
    moveBuffer.clear(); // fiddling after the session finished doesn't belong to the fresh queue
  }

  const progress = selectCurrentProgress(state);
  const targetTokens = variant ? variant.alg.trim().split(/\s+/).filter(Boolean) : [];
  const finished = queue.length === 0;
  const totalSessionMs =
    finished && sessionStartTime !== null && state.endTime !== null ? state.endTime - sessionStartTime : null;

  // "Attack times" tracks the full-execution total per past session
  // (oldest -> newest), not individual case times within the current run —
  // that's what the per-case list below the queue is for.
  const sessionTotalsMs = useMemo(() => [...history].sort((a, b) => a.date - b.date).map((s) => s.totalMs), [history]);

  const timerState: "idle" | "solving" | "solved" =
    finished ? "solved" : state.phase === "active" ? "solving" : "idle";

  return (
    <>
    <TrainerPanel
      header={
        <div className="flex items-center gap-1 w-full">
          {ATTACK_TABS.map((t) => {
            const isActive = t.id === "f2l" ? group.startsWith("f2l-") : group === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setGroup(t.id === "f2l" ? f2lSlot : t.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  isActive ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                }`}
                style={isActive ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined}
              >
                {t.label}
              </button>
            );
          })}
          {group.startsWith("f2l-") && (
            <div className="flex items-center gap-0.5 ml-1 pl-2 border-l border-white/[0.08]">
              <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">Slot</span>
              {F2L_SLOTS.map((s) => (
                <button
                  key={s.id}
                  title={s.title}
                  onClick={() => {
                    setF2lSlot(s.id);
                    setGroup(s.id);
                  }}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                    group === s.id ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <span className="ml-auto text-xs text-gray-500 tabular-nums font-mono">
            {completed.length} / {cases.length}
          </span>
          <div className="shrink-0">
            <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
          </div>
        </div>
      }
      moves={targetTokens}
      progress={progress}
      showMaskToggle
      maskMoves={maskMoves}
      onToggleMask={toggleMaskMoves}
      loadingText={finished ? "Session complete!" : undefined}
      completeText="Algorithm complete!"
      centerTop={
        finished ? (
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-lg font-semibold text-emerald-400">Session Complete!</p>
            {totalSessionMs !== null && (
              <p className="text-xs text-gray-500 font-mono tabular-nums">Total: {formatTimeMs(totalSessionMs)}</p>
            )}
          </div>
        ) : currentCase ? (
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="text-lg font-bold text-white">{currentCase.name}</h2>
            <p className="text-xs text-gray-500">{currentCase.category}</p>
          </div>
        ) : null
      }
      timeMs={sessionElapsedSec * 1000}
      timerState={timerState}
      hintText={!finished && state.phase === "setup" ? "Make a move to start" : null}
      controls={
        <button onClick={handleRestart} className="btn-secondary">
          <RotateCcw size={13} /> Restart
        </button>
      }
      cubeRef={cubeRef}
      visualization="3D"
      stickering={STICKERING[group]}
      hintFacelets={viewPrefs.backStickers ? "floating" : "none"}
      hintFaceletsElevation={viewPrefs.hintElevation}
      flatCubeRef={flatCubeRef}
      showFlatView={viewPrefs.flatView}
      cubeToolbar={<CaseViewToggles {...viewPrefs} />}
      cameraLatitude={CAMERA[group].latitude}
      cameraLongitude={CAMERA[group].longitude}
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
                      group={group}
                      isActive={i === 0}
                      onEdit={() => setEditingCase(c)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
          {completed.length > 0 && (
            <div className="divide-y divide-gray-800/40 border-t border-gray-800">
              {[...completed].reverse().map((entry) => (
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
                Recent {GROUP_LABELS[group] ?? group} attack sessions
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

    {editingCase && (
      <CaseEdit
        case_={editingCase}
        group={group}
        onSave={(updated) => {
          updateCase(group, updated);
          setEditingCase(null);
          setCases(loadAlgGroup(group));
        }}
        onClose={() => setEditingCase(null)}
      />
    )}
    </>
  );
}

function SortableQueueItem({
  id,
  case_,
  group,
  isActive,
  onEdit,
}: {
  id: string;
  case_: AlgorithmCase;
  group: AlgGroup;
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
        group={group}
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
