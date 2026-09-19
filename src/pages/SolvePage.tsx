/**
 * SolvePage — speed solve mode: random scramble -> timed solve.
 *
 * Thin controller over the shared session reducer + TrainerPanel: wires
 * hardware/spacebar/solved-detection hooks to the session, and maps session
 * state to TrainerPanel props. No business logic lives here — matching,
 * timing, and error tracking all come from sessionReducer/sequenceTracker.
 *
 * The 3D cube is a live mirror of physical moves: every move from hardware
 * is applied to it via addMove(), unconditionally, regardless of phase. This
 * keeps it in sync with the real cube without any phase-specific logic, and
 * is what makes isSolved() detection valid during free solving.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardPaste, CheckCircle2, FolderInput, Info, Plus, RotateCcw, Trash2 } from "lucide-react";
import { SessionProvider, useSession } from "../state/sessionContext";
import { selectCurrentProgress, selectMoveCount, selectSolveTimeMs, selectTPS } from "../state/sessionSelectors";
import { collapseIdenticalMoves } from "../logic/moveReduction";
import { parseMove } from "../logic/moveParser";
import { sessionMethodsForInput } from "../logic/inputMethod";
import { useSmartCube } from "../hooks/useSmartCube";
import { useSpacebar } from "../hooks/useSpacebar";
import { useTimerDevice } from "../hooks/useTimerDevice";
import { useSolvedDetection } from "../hooks/useSolvedDetection";
import { useScrambleGenerator } from "../hooks/useScrambleGenerator";
import { useAnimationTimer } from "../hooks/useAnimationTimer";
import { useMethodProgress } from "../hooks/useMethodProgress";
import { useMaskMoves } from "../hooks/useMaskMoves";
import { useInspectionBeeps } from "../hooks/useInspectionBeeps";
import { TrainerPanel } from "../components/TrainerPanel";
import { ConnectionPanel } from "../components/ConnectionPanel";
import { SolveControls } from "../components/SolveControls";
import { StageStepper } from "../components/StageStepper";
import { SolveAnalysis } from "../components/SolveAnalysis";
import { SolveSummary } from "../components/SolveSummary";
import { recordFluency } from "../logic/stageDetection/fluency";
import { CompactRecentList } from "../components/CompactRecentList";
import { SessionPicker, SessionEditModal } from "../components/SessionManager";
import { CaseViewToggles } from "../components/CaseViewToggles";
import { useCaseViewPrefs } from "../hooks/useCaseViewPrefs";
import { useCubeViewRefs } from "../hooks/useCubeViewRefs";
import type { SessionConfig, StartMethod } from "../types/session";
import type { SolveRecord, StoredSession } from "../types/solve";
import { cfopStageDetector } from "../logic/stageDetection/cfopStages";
import { rouxStageDetector, ROUX_DETAIL_VERSION } from "../logic/stageDetection/rouxStages";
import { lblStageDetector } from "../logic/stageDetection/lblStages";
import { computeStageBoundaries } from "../logic/stageDetection/methodTracker";
import { detectorForMethod } from "../logic/stageDetection/methodRegistry";
import { formatTimeMs, formatRelativeTime } from "../logic/statistics";
import { formatDate, t } from "../i18n/i18n";
import { useT } from "../i18n/useT";
import {
  CUSTOM_SCRAMBLES_SESSION_NAME,
  deleteSessionAndSolves,
  deleteSolve,
  ensureCustomScramblesSession,
  ensureDefaultSession,
  getSessions,
  getSolvesForSession,
  patchSolve,
  saveSession,
  saveSolve,
} from "../services/solveStore";

function buildStartHint(methods: readonly StartMethod[]): string {
  const labels: string[] = [];
  if (methods.includes("cube-move")) labels.push(t("solve.hint.makeMove"));
  if (methods.includes("spacebar")) labels.push(t("solve.hint.pressSpace"));
  if (methods.includes("timer-device")) labels.push(t("solve.hint.startTimer"));
  if (labels.length === 0) return "";
  const text =
    labels.length === 1
      ? labels[0]
      : labels.length === 2
        ? t("solve.hint.or2", { a: labels[0], b: labels[1] })
        : t("solve.hint.or3", { list: labels.slice(0, -1).join(", "), last: labels[labels.length - 1] });
  const sentence = t("solve.hint.toBegin", { text });
  return `${sentence[0].toUpperCase()}${sentence.slice(1)}`;
}

type SolveSortKey = "nr" | "time" | "moves" | "tps" | "fluency";

/**
 * Sort options for the Recent solves list. `defaultAsc` is the direction a
 * FIRST click on that key gets — chosen per what a solver most likely wants
 * to see on top: newest solve (# desc), fastest time (asc), fewest moves
 * (asc), highest TPS (desc), highest (best) fluency (desc). Clicking the
 * already-active key flips it. Rendered as clickable column headers in the
 * expanded table (see SortableTh below), not a separate row of chips.
 */
const SOLVE_SORT_OPTIONS: { key: SolveSortKey; label: string; defaultAsc: boolean }[] = [
  { key: "nr", label: "#", defaultAsc: false },
  { key: "time", label: "Time", defaultAsc: true },
  { key: "moves", label: "Moves", defaultAsc: true },
  { key: "tps", label: "TPS", defaultAsc: false },
  { key: "fluency", label: "Fluency", defaultAsc: false },
];

/** Sort keys that need time data — unreachable (and irrelevant) in a moveCountOnly session; see effectiveSortKey. */
const TIME_BASED_SORT_KEYS = new Set<SolveSortKey>(["time", "tps", "fluency"]);

/** A `<th>` that sorts the solves table by `sortKey` on click, showing an arrow when it's the active column. */
function SortableTh({
  label,
  sortKey,
  activeKey,
  ascending,
  onSort,
  align = "left",
  tooltip,
}: {
  label: string;
  sortKey: SolveSortKey;
  activeKey: SolveSortKey;
  ascending: boolean;
  onSort: (key: SolveSortKey) => void;
  align?: "left" | "right";
  /** Explanation icon after the label — e.g. what "Fluency" means. */
  tooltip?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th className={`py-2 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>
      <span className="inline-flex items-center gap-1">
        <button
          onClick={() => onSort(sortKey)}
          className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider transition-colors hover:text-gray-200 ${
            active ? "text-white" : "text-gray-500"
          }`}
        >
          {label}
          <span className="w-2.5 inline-block text-gray-400">{active ? (ascending ? "↑" : "↓") : ""}</span>
        </button>
        {tooltip && (
          <span title={tooltip} className="inline-flex shrink-0">
            <Info size={11} className="text-gray-600" />
          </span>
        )}
      </span>
    </th>
  );
}

// Recent solves list page size — persisted (shared across sessions) so it
// doesn't have to be re-picked every time.
const PAGE_SIZE_STORAGE_KEY = "nact_solve_list_page_size";
const PAGE_SIZE_OPTIONS: (number | "all")[] = [10, 25, 50, 100, "all"];

function readStoredPageSize(): number | "all" {
  try {
    const raw = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (raw === "all") return "all";
    const n = Number(raw);
    if (Number.isFinite(n) && PAGE_SIZE_OPTIONS.includes(n)) return n;
  } catch {
    // localStorage unavailable — fall through to the default.
  }
  return 25;
}

export interface SolvePageProps {
  /** Called once per completed (and persisted) solve. */
  onSolved?: (record: SolveRecord) => void;
}

export default function SolvePage({ onSolved }: SolvePageProps) {
  const [sessions, setSessions] = useState<StoredSession[]>(() => {
    ensureDefaultSession();
    ensureCustomScramblesSession();
    return getSessions();
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => sessions.find((s) => s.name !== CUSTOM_SCRAMBLES_SESSION_NAME)?.id ?? sessions[0].id
  );
  const [editModal, setEditModal] = useState<"new" | StoredSession | null>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];
  const customScramblesSessionId = useMemo(
    () => sessions.find((s) => s.name === CUSTOM_SCRAMBLES_SESSION_NAME)?.id ?? activeSession.id,
    [sessions, activeSession.id]
  );

  const config = useMemo<SessionConfig>(
    () => ({
      mode: "solve",
      ...sessionMethodsForInput(activeSession.inputMethod),
      useInspection: activeSession.inspectionMode !== "unlimited",
      inspectionSeconds: activeSession.inspectionMode === "custom" ? activeSession.customInspectionSeconds : 15,
    }),
    [activeSession.inputMethod, activeSession.inspectionMode, activeSession.customInspectionSeconds]
  );

  // Every behavior-affecting session setting is part of the remount key, so
  // EDITING the active session applies immediately — id alone is not enough:
  // SessionProvider takes `config` only as the reducer's initial state, so
  // a same-id save (settings edit via the gear) used to change nothing
  // until you switched away and back. Name and solveMethod are deliberately
  // NOT in the key: name is cosmetic, and the live tracker already handles
  // a method change on its own (see useMethodProgress's walker reset).
  const providerKey = [
    activeSessionId,
    activeSession.inputMethod,
    activeSession.startingStage,
    activeSession.inspectionMode,
    activeSession.customInspectionSeconds,
  ].join(":");

  function handleSaveSession(session: StoredSession) {
    saveSession(session);
    setSessions(getSessions());
    setActiveSessionId(session.id);
    setEditModal(null);
  }

  function handleDeleteSession(session: StoredSession) {
    deleteSessionAndSolves(session.id);
    const next = getSessions();
    setSessions(next);
    if (activeSessionId === session.id) {
      setActiveSessionId(next.find((s) => s.name !== CUSTOM_SCRAMBLES_SESSION_NAME)?.id ?? next[0].id);
    }
  }

  return (
    <>
      {/* The key forces a clean remount of the whole session reducer +
          SolvePageInner's local state whenever the active session OR its
          behavior-affecting settings change — simpler and safer than
          reconciling every piece of transient in-flight state (moveLog,
          paste box, analysis modal...) against a config swap mid-render. */}
      <SessionProvider key={providerKey} config={config}>
        <SolvePageInner
          onSolved={onSolved}
          session={activeSession}
          customScramblesSessionId={customScramblesSessionId}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSwitchSession={setActiveSessionId}
          onCreateSession={() => setEditModal("new")}
          onEditSession={(s) => setEditModal(s)}
          onDeleteSession={handleDeleteSession}
          onSessionsChanged={() => setSessions(getSessions())}
        />
      </SessionProvider>

      {editModal && (
        <SessionEditModal session={editModal === "new" ? null : editModal} onClose={() => setEditModal(null)} onSave={handleSaveSession} />
      )}
    </>
  );
}

interface SolvePageInnerProps extends SolvePageProps {
  session: StoredSession;
  customScramblesSessionId: string;
  sessions: StoredSession[];
  activeSessionId: string;
  onSwitchSession: (id: string) => void;
  onCreateSession: () => void;
  onEditSession: (session: StoredSession) => void;
  onDeleteSession: (session: StoredSession) => void;
  /** The sessions list in storage changed outside the parent's own handlers (e.g. a session created inline as a move target) — re-read it. */
  onSessionsChanged: () => void;
}

function SolvePageInner({
  onSolved,
  session,
  customScramblesSessionId,
  sessions,
  activeSessionId,
  onSwitchSession,
  onCreateSession,
  onEditSession,
  onDeleteSession,
  onSessionsChanged,
}: SolvePageInnerProps) {
  const { t, tn } = useT();
  const { state, submitCubeMove, startInspection, setTarget, confirmManualSetup } = useSession();
  const { cubeRef, flatCubeRef, view } = useCubeViewRefs();
  const viewPrefs = useCaseViewPrefs(false, "solve");
  const { generate, isGenerating, error: scrambleError } = useScrambleGenerator();

  // Custom scramble entry — paste/type your own instead of a random one.
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteInput, setPasteInput] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const pasteInputRef = useRef<HTMLInputElement>(null);

  // Set right before a paste/reuse-triggered setTarget() call — read once at
  // save time so that ONE attempt's resulting solve routes into the Custom
  // Scrambles session regardless of which session is otherwise active, then
  // reset so the next (normally-generated) attempt goes back to normal.
  const isCustomScrambleRef = useRef(false);

  const [solves, setSolves] = useState<SolveRecord[]>(() => getSolvesForSession(session.id));
  // The full-screen analysis modal — opened by clicking a PAST solve in the
  // history list (or the expand button on the inline summary), never
  // automatically.
  const [analysisRecord, setAnalysisRecord] = useState<SolveRecord | null>(null);
  // The solve that JUST finished, shown inline in the stats column so the
  // freshly generated next scramble stays visible — dismissed by the first
  // move of that next scramble (see the effect below the completion one).
  const [summaryRecord, setSummaryRecord] = useState<SolveRecord | null>(null);
  // Per-row action state for the Recent solves list.
  const [moveMenuSolveId, setMoveMenuSolveId] = useState<string | null>(null);
  const [confirmDeleteSolveId, setConfirmDeleteSolveId] = useState<string | null>(null);
  // "Move to a session that doesn't exist yet": which solve to move once the
  // create-session modal (rendered at the bottom) is saved. Deliberately
  // does NOT switch the active session — the point is to file the solve
  // away, not to go there.
  const [createSessionForSolve, setCreateSessionForSolve] = useState<SolveRecord | null>(null);

  // Recent solves list sorting — see SOLVE_SORT_OPTIONS. Solve numbers are
  // POSITIONAL within the session (1 = oldest), assigned before sorting, so
  // they stay stable across re-sorts (and renumber on deletion, csTimer-style).
  const [sortKey, setSortKey] = useState<SolveSortKey>("nr");
  const [sortAsc, setSortAsc] = useState(false);
  // A "time"/"tps"/"recognition" sort chosen before Move count only was
  // switched on stays applied (nothing to reset it), just no longer
  // reachable via a header — fall back to session order so the
  // un-highlighted list isn't silently sorted by a metric the UI no longer
  // shows a column for.
  const effectiveSortKey = session.moveCountOnly && TIME_BASED_SORT_KEYS.has(sortKey) ? "nr" : sortKey;
  const handleSort = (key: SolveSortKey) => {
    if (effectiveSortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(SOLVE_SORT_OPTIONS.find((o) => o.key === key)!.defaultAsc);
    }
    setPage(1);
  };
  const sortedSolves = useMemo(() => {
    const numbered = solves.map((record, i) => ({ record, nr: i + 1 }));
    const value = (e: (typeof numbered)[number]): number => {
      switch (effectiveSortKey) {
        case "nr":
          return e.nr;
        case "time":
          return e.record.timeMs;
        case "moves":
          return e.record.moveCount;
        case "tps":
          return e.record.tps;
        case "fluency":
          // Solves with no fluency data (unknown method) sort last
          // regardless of direction, rather than skewing among real values.
          return recordFluency(e.record) ?? (sortAsc ? Infinity : -Infinity);
      }
    };
    numbered.sort((a, b) => (value(a) - value(b)) * (sortAsc ? 1 : -1));
    return numbered;
  }, [solves, effectiveSortKey, sortAsc]);

  // Recent solves list: collapsed by default to the compact sidebar preview
  // (CompactRecentList, in statsAside) — this flips it to the full sortable/
  // paginated table (the `bottom` block below) instead.
  const [solvesExpanded, setSolvesExpanded] = useState(false);

  // Recent solves pagination — page size persists across sessions (csTimer-
  // style), current page does not (SolvePageInner remounts per session via
  // providerKey, and re-sorting/re-sizing jumps back to page 1 below).
  const [itemsPerPage, setItemsPerPage] = useState<number | "all">(readStoredPageSize);
  const [page, setPage] = useState(1);
  const totalPages = itemsPerPage === "all" ? 1 : Math.max(1, Math.ceil(sortedSolves.length / itemsPerPage));
  const clampedPage = Math.min(page, totalPages);
  const pagedSolves = useMemo(() => {
    if (itemsPerPage === "all") return sortedSolves;
    const start = (clampedPage - 1) * itemsPerPage;
    return sortedSolves.slice(start, start + itemsPerPage);
  }, [sortedSolves, itemsPerPage, clampedPage]);

  function handlePageSizeChange(next: number | "all") {
    setItemsPerPage(next);
    setPage(1);
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(next));
    } catch {
      // localStorage unavailable — preference just won't persist across reloads.
    }
  }

  function handleDeleteSolve(record: SolveRecord) {
    deleteSolve(record.id);
    setSolves(getSolvesForSession(session.id));
    if (analysisRecord?.id === record.id) setAnalysisRecord(null);
    if (summaryRecord?.id === record.id) setSummaryRecord(null);
    setConfirmDeleteSolveId(null);
  }

  function handleMoveSolve(record: SolveRecord, targetSessionId: string) {
    patchSolve(record.id, { sessionId: targetSessionId });
    // Re-read rather than splice locally — covers both directions (a record
    // leaving this session's list, or a Custom-Scrambles-routed one opened
    // from the summary being moved INTO it).
    setSolves(getSolvesForSession(session.id));
    if (analysisRecord?.id === record.id) setAnalysisRecord(null);
    if (summaryRecord?.id === record.id) setSummaryRecord(null);
    setMoveMenuSolveId(null);
  }
  const sessionTimesMs = solves.map((s) => s.timeMs);
  const sessionMoveCounts = solves.map((s) => s.moveCount);
  const { maskMoves, toggleMaskMoves } = useMaskMoves();

  // Starting the next attempt: a "scratch" session gets a fresh random
  // scramble same as before. Any other starting stage has no scramble to
  // generate — it hands off straight to the manual-setup flow (empty
  // target, "setup" phase) so the solver builds the starting position by
  // hand and taps Ready (confirmManualSetup / ActionType.MANUAL_SETUP_DONE)
  // whenever they're set up.
  const startNextAttempt = useCallback(() => {
    if (session.startingStage === "scratch") {
      void generate();
    } else {
      setTarget("");
    }
  }, [session.startingStage, generate, setTarget]);

  /**
   * Abandon whatever's been done on the CURRENT attempt (scrambling or
   * solving) and restart tracking the SAME scramble from scratch — unlike
   * Cancel/Discard (startNextAttempt), which moves on to a brand new one.
   * Re-arming with the identical notation re-enters "setup" with a cleared
   * moveLog/timer; the targetNotation-keyed effect below won't fire (the
   * string didn't change), so the visual mirror is reset here explicitly —
   * same reasoning as the case-loading effect in TrainingPage.
   */
  const resetAttempt = useCallback(() => {
    view.reset();
    setTarget(state.targetNotation);
    // The dismiss effect below only clears these on the FIRST move of a
    // fresh "setup" (moveLog.length > 0) — re-arming here lands on an EMPTY
    // moveLog, so it wouldn't fire; clear explicitly instead of leaving a
    // stale summary/analysis modal next to the just-reset scramble.
    setSummaryRecord(null);
    setAnalysisRecord(null);
  }, [view, setTarget, state.targetNotation]);

  // Every physical move mirrors 1:1 into the 3D view, unconditionally —
  // it's a live shadow of the real cube, not phase-aware.
  const handleMove = useCallback(
    (move: string, timestamp: number) => {
      submitCubeMove(move, timestamp);
      view.addMove(move);
    },
    [submitCubeMove, view]
  );

  const cube = useSmartCube({ onMove: handleMove });
  const timer = useTimerDevice();
  // Hold-to-start (cstimer/StackMat style): release before holdDurationMs
  // and nothing happens; release at/after it and the attempt starts. See
  // useSpacebar's doc comment for why there's no maximum hold time.
  const { pressState: spacebarPressState } = useSpacebar({ holdToStart: true });
  useSolvedDetection(cubeRef);

  // One unified "hold to start" indicator regardless of which input method
  // is actually armed — spacebar and the BT timer are mutually exclusive in
  // practice (only one is the configured startMethod at a time), but this
  // avoids ever having to ask which one is "active" here.
  const pressState = timer.pressState !== "idle" ? timer.pressState : spacebarPressState;

  // Start the first attempt on mount (scratch: generate; other stages: manual setup).
  useEffect(() => {
    startNextAttempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A cube disconnect mid-attempt resets the session back to "idle" (see
  // sessionContext's abort-on-disconnect effect), which wipes the scramble
  // off the screen — reconnecting doesn't undo that on its own, so without
  // this the solver is left staring at a blank scramble bar until they
  // manually refresh or switch tabs. Regenerate the next attempt the moment
  // the cube comes back, but only if nothing else already claimed "idle" in
  // the meantime (i.e. this reconnect is the reason we're here).
  const wasCubeConnectedRef = useRef(cube.connected);
  useEffect(() => {
    if (!wasCubeConnectedRef.current && cube.connected && state.phase === "idle") {
      startNextAttempt();
    }
    wasCubeConnectedRef.current = cube.connected;
  }, [cube.connected, state.phase, startNextAttempt]);

  // Reset the 3D view whenever a new scramble is set.
  const targetNotation = state.targetNotation;
  useEffect(() => {
    view.reset();
  }, [targetNotation, view]);

  useEffect(() => {
    if (isPasteOpen) {
      const id = setTimeout(() => pasteInputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [isPasteOpen]);

  // Leaving "setup" (scrambling done, solve starting some other way) closes
  // any still-open paste box rather than leaving it stranded mid-solve.
  useEffect(() => {
    if (state.phase !== "setup") {
      setIsPasteOpen(false);
      setPasteError(null);
    }
  }, [state.phase]);

  function applyCustomScramble() {
    const tokens = pasteInput.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      setPasteError(t("solve.paste.empty"));
      return;
    }
    const invalid = tokens.filter((t) => !parseMove(t));
    if (invalid.length > 0) {
      setPasteError(t("solve.paste.invalid", { moves: invalid.join(" ") }));
      return;
    }
    isCustomScrambleRef.current = true;
    setTarget(tokens.join(" "));
    setIsPasteOpen(false);
    setPasteInput("");
    setPasteError(null);
  }

  // Auto-enter inspection the moment the scramble is completed, if configured.
  useEffect(() => {
    if (state.phase === "ready" && state.config.useInspection) {
      startInspection();
    }
  }, [state.phase, state.config.useInspection, startInspection]);

  // Live-ticking display values. useAnimationTimer already returns the
  // correct final value once both start/end are set (the "done" case), so
  // no separate static branch is needed for the main timer.
  const rawDisplaySec = useAnimationTimer(state.startTime, state.endTime, state.phase === "active");
  // The finished solve's time keeps showing on the BIG timer across the
  // next scramble being armed (state.startTime/endTime null out the moment
  // the fresh target lands, which would otherwise snap the timer to
  // 0.000 before the solver has even looked away) — held until they
  // actually move on: the first move of scrambling/setup, or starting the
  // next solve via the timer/spacebar. `phase !== "active"` guards a solve
  // that starts WITHOUT any scrambling move ever ticking (so summaryRecord
  // is still non-null for the render where phase first flips to "active");
  // matches the dismiss effect below exactly.
  const holdingLastResult = summaryRecord !== null && state.phase !== "active";
  const displaySec = summaryRecord && state.phase !== "active" ? summaryRecord.timeMs / 1000 : rawDisplaySec;
  const inspectionElapsedSec = useAnimationTimer(
    state.inspectionStartTime,
    null,
    state.phase === "inspecting"
  );
  const inspectionRemaining = state.config.inspectionSeconds - inspectionElapsedSec;
  // Beep at 7s and 3s remaining — for the official 15s inspection that's
  // exactly the WCA judge's "8 seconds!" / "12 seconds!" calls.
  useInspectionBeeps(state.phase === "inspecting", inspectionRemaining, state.config.inspectionSeconds);

  const solveTimeMs = selectSolveTimeMs(state);
  const moveCount = selectMoveCount(state);
  const tps = selectTPS(state);
  // Mirrors displaySec's "hold the last result" logic. Outside active/done
  // moveLog holds SCRAMBLE moves (it's only reset when the solve starts), so
  // the timer must not count those — show 0, exactly like the time display
  // sits at 0.000 until the solve begins.
  const displayMoveCount =
    summaryRecord && state.phase !== "active"
      ? summaryRecord.moveCount
      : state.phase === "active" || state.phase === "done"
        ? moveCount
        : 0;

  const progress = selectCurrentProgress(state);
  const targetTokens = state.targetNotation.trim().split(/\s+/).filter(Boolean);

  // Live progress for the session's configured solving method (see
  // StoredSession.solveMethod — a per-session setting, not auto-detected;
  // see methodResolvers.ts for the dormant auto-detect/suggestion
  // machinery this could plug into later), over the solve's own moves
  // (moveLog is reset to just the solve once "active" begins). Tracked
  // incrementally via useMethodProgress rather than replayed from scratch
  // on every move.
  const trackMethod = state.phase === "active" || state.phase === "done";
  const activeDetector = detectorForMethod(session.solveMethod);
  const { boundaries: liveBoundaries, startState } = useMethodProgress(
    state.targetNotation,
    trackMethod ? state.moveLog : [],
    activeDetector
  );

  // Persist exactly once per completed attempt. `method` comes straight
  // from the session's configured solveMethod (see StoredSession) — no
  // auto-detection happens here, that's future work (methodResolvers.ts).
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (state.phase !== "done") {
      notifiedRef.current = false;
      return;
    }
    if (notifiedRef.current || solveTimeMs === null || state.startTime === null || state.endTime === null) return;
    notifiedRef.current = true;

    const method = session.solveMethod;
    // Which of the several enabled methods actually triggered THIS attempt
    // — startedBy/endedBy are set by the reducer per-attempt (see
    // ActionType.START_SIGNAL / STOP_SIGNAL / CUBE_SOLVED), since
    // config.startMethod/stopMethod are now the whole enabled SET, not a
    // single value. Falls back to the config's first entry defensively —
    // should never actually be needed once a "done" solve has been reached.
    const startMethod = state.startedBy ?? state.config.startMethod[0] ?? "cube-move";
    const stopMethod = state.endedBy ?? state.config.stopMethod[0] ?? "cube-solved";

    // Recompute cfop/roux/lbl boundaries fresh from state.moveLog RIGHT
    // HERE, in one batch call each, rather than relying on any live-tracked
    // value — the live view (liveBoundaries above) only tracks whichever
    // method the session is configured for, not all three, and even the
    // old always-both live tracking was observed to lag one render behind
    // state.moveLog for a fast (<50ms) trailing double-turn (e.g. a quick
    // AUF), silently dropping the final stage from the saved record even
    // though the move itself was captured correctly. Recomputing
    // synchronously here, from the exact same state.moveLog that becomes
    // record.moves below, makes the two impossible to diverge. startState
    // is loaded once at mount, long before any solve can finish, so the
    // empty-array fallback is defensive only — it should never actually be
    // hit.
    const timedMoves = state.moveLog.map((m) => ({ move: m.move, relativeMs: m.relativeMs }));
    const freshCfop = startState ? computeStageBoundaries(cfopStageDetector, timedMoves, startState) : [];
    const freshRoux = startState ? computeStageBoundaries(rouxStageDetector, timedMoves, startState) : [];
    const freshLbl = startState ? computeStageBoundaries(lblStageDetector, timedMoves, startState) : [];

    // Pasted/reused scrambles route into the Custom Scrambles session
    // regardless of whichever session is otherwise active — a one-off
    // reroute for THIS attempt only, consumed and reset right here.
    const wasCustomScramble = isCustomScrambleRef.current;
    isCustomScrambleRef.current = false;
    const targetSessionId = wasCustomScramble ? customScramblesSessionId : session.id;

    const record: SolveRecord = {
      id: crypto.randomUUID(),
      sessionId: targetSessionId,
      method,
      startMethod,
      stopMethod,
      timerStartedAt: state.startTime,
      firstMoveAt: state.moveLog[0]?.timestamp ?? null,
      timeToFirstMoveMs: state.moveLog[0] ? state.moveLog[0].timestamp - state.startTime : null,
      endedAt: state.endTime,
      timeMs: solveTimeMs,
      scramble: state.targetNotation,
      scrambleMoves: targetTokens,
      moves: state.moveLog,
      reducedMoves: collapseIdenticalMoves(state.moveLog.map((m) => m.move)),
      moveCount,
      tps: tps ?? 0,
      cfop: freshCfop,
      roux: freshRoux,
      rouxDetailVersion: ROUX_DETAIL_VERSION,
      lbl: freshLbl,
      isDNF: false,
    };

    saveSolve(record);
    // Only mirror into the visible "this session" list/stats if it actually
    // landed in this session — a Custom-Scrambles-routed solve is reviewed
    // by switching to that session instead.
    if (targetSessionId === session.id) {
      setSolves((prev) => [...prev, record]);
    }
    setSummaryRecord(record);
    onSolved?.(record);

    // Auto-advance: the next attempt is started right away, so its scramble
    // is immediately visible next to the inline summary — the summary (its
    // own snapshot of `record`, independent of live session state) stays up
    // until the user actually starts performing that scramble (see the
    // dismissing effect below).
    startNextAttempt();
  }, [state.phase, solveTimeMs, state.startTime, state.endTime, state.moveLog, state.targetNotation, state.startedBy, state.endedBy, state.config.startMethod, state.config.stopMethod, moveCount, tps, startState, session.id, session.solveMethod, customScramblesSessionId, targetTokens, onSolved, startNextAttempt]);

  // Dismiss the inline summary (and any open analysis modal, and the held
  // timer display above) the moment the user moves on to the next attempt —
  // either by starting to mix the auto-generated scramble (first move of
  // the new "setup" phase) or by starting the solve itself (spacebar/BT
  // timer, in case that ever fires with no scrambling move logged) —
  // returns to the plain cube + scramble view.
  useEffect(() => {
    if (!summaryRecord && !analysisRecord) return;
    if ((state.phase === "setup" && state.moveLog.length > 0) || state.phase === "active") {
      setSummaryRecord(null);
      setAnalysisRecord(null);
    }
  }, [summaryRecord, analysisRecord, state.phase, state.moveLog.length]);

  const timerState: "idle" | "holding" | "armed" | "inspecting" | "solving" | "solved" =
    holdingLastResult
      ? "solved"
      : state.phase === "ready" && pressState !== "idle"
        ? pressState
        : state.phase === "inspecting"
          ? "inspecting"
          : state.phase === "active"
            ? "solving"
            : state.phase === "done"
              ? "solved"
              : "idle";

  const hintText =
    state.phase === "setup"
      ? session.startingStage === "scratch"
        ? t("solve.hint.scramble")
        : t("solve.hint.manualSetup")
      : state.phase === "ready" || state.phase === "inspecting"
        ? pressState === "armed"
          ? t("solve.hint.release")
          : pressState === "holding"
            ? t("solve.hint.holding")
            : buildStartHint(state.config.startMethod)
        : state.phase === "done"
          ? session.moveCountOnly
            ? tn("count.moves", moveCount)
            : t("solve.movesTps", { moves: tn("count.moves", moveCount), tps: tps ? tps.toFixed(2) : "—" })
          : null;

  // The scramble notation is only useful while it's actually being
  // performed (phase "setup") — the moment it's fully matched, the bar
  // switches to the stage stepper (the dot/circle progress view) for the
  // rest of the attempt, rather than showing a small status text. A fresh
  // scramble (from the auto-advance in the completion effect above) brings
  // the notation back the moment the next "setup" phase's target lands.
  const showStepperInBar = state.phase === "ready" || state.phase === "inspecting" || state.phase === "active" || state.phase === "done";

  return (
    <>
    <TrainerPanel
      layout="side"
      header={
        <div className="flex items-center gap-3 w-full">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{t("solve.title")}</span>
          <div className="ml-auto flex items-center gap-2">
            <SessionPicker
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSwitch={onSwitchSession}
              onCreate={onCreateSession}
              onEdit={onEditSession}
              onDelete={onDeleteSession}
            />
            <ConnectionPanel
              cube={cube}
              onConnectCube={cube.connect}
              onDisconnectCube={cube.disconnect}
              timer={timer}
              onConnectTimer={timer.connect}
              onDisconnectTimer={timer.disconnect}
            />
          </div>
        </div>
      }
      moves={targetTokens}
      progress={progress}
      showMaskToggle
      maskMoves={maskMoves}
      onToggleMask={toggleMaskMoves}
      showRefresh
      onRefresh={startNextAttempt}
      loadingText={isGenerating ? t("solve.generating") : (scrambleError ?? undefined)}
      sequenceTop={
        // While the previous solve's summary is still up, make it obvious
        // the bar already shows the NEXT attempt's scramble — disappears
        // together with the summary on the first scrambling move.
        summaryRecord && state.phase === "setup" ? (
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 px-1">{t("solve.nextScramble")}</p>
        ) : undefined
      }
      sequenceTrailing={
        session.startingStage === "scratch" && (state.phase === "setup" || state.phase === "ready") ? (
          <button
            onClick={() => {
              setIsPasteOpen(true);
              setPasteInput("");
              setPasteError(null);
            }}
            title={t("solve.paste.title")}
            className="control-button"
          >
            <ClipboardPaste size={20} />
          </button>
        ) : undefined
      }
      sequenceContent={
        isPasteOpen ? (
          <div className="scramble-card">
            <div className="flex items-center gap-2 p-3">
              <input
                ref={pasteInputRef}
                type="text"
                value={pasteInput}
                onChange={(e) => {
                  setPasteInput(e.target.value);
                  setPasteError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyCustomScramble();
                  if (e.key === "Escape") setIsPasteOpen(false);
                }}
                placeholder={t("solve.paste.placeholder")}
                className="flex-1 bg-gray-950/60 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <button onClick={applyCustomScramble} disabled={!pasteInput.trim()} className="btn-primary py-2">
                <CheckCircle2 size={13} /> {t("solve.paste.apply")}
              </button>
              <button onClick={() => setIsPasteOpen(false)} className="btn-secondary py-2">
                {t("common.cancel")}
              </button>
            </div>
            {pasteError && <p className="px-3 pb-3 text-xs text-red-400">{pasteError}</p>}
          </div>
        ) : showStepperInBar ? (
          <div className="scramble-card">
            <StageStepper stages={activeDetector.stages} boundaries={liveBoundaries} />
          </div>
        ) : undefined
      }
      isInspecting={state.phase === "inspecting"}
      inspectionSecondsLeft={inspectionRemaining}
      inspectionMode={session.inspectionMode}
      timeMs={displaySec * 1000}
      timerState={timerState}
      moveCountOnly={session.moveCountOnly}
      moveCount={displayMoveCount}
      hintText={hintText}
      summary={
        holdingLastResult && summaryRecord ? (
          <SolveSummary record={summaryRecord} moveCountOnly={session.moveCountOnly} />
        ) : undefined
      }
      onCenterClick={holdingLastResult && summaryRecord ? () => setAnalysisRecord(summaryRecord) : undefined}
      controls={
        <div className="flex items-center gap-2">
          {state.phase !== "idle" && (
            <button
              onClick={resetAttempt}
              className="btn-secondary text-xs"
              title={t("solve.reset.title")}
            >
              <RotateCcw size={13} /> {t("solve.reset")}
            </button>
          )}
          <SolveControls
            mode="solve"
            isActive={state.phase === "active" || state.phase === "inspecting"}
            onDiscard={startNextAttempt}
            onSaveAsDNF={startNextAttempt}
            onResetCube={() => {
              view.reset();
              state.moveLog.forEach((m) => view.addMove(m.move));
            }}
            // No manual stop trigger (spacebar/timer) enabled -> Cancel can
            // only mean "give up", so skip the Discard/Save-as-DNF menu and
            // discard directly. Once a manual method is available the user
            // has a legitimate way to end early on purpose, so the full menu
            // (including Save as DNF) applies.
            stopByCube={!state.config.stopMethod.includes("spacebar") && !state.config.stopMethod.includes("timer-device")}
          />
        </div>
      }
      centerBottom={
        state.phase === "setup" && !isPasteOpen ? (
          <button
            onClick={confirmManualSetup}
            className="btn-secondary text-xs"
            title={
              session.startingStage === "scratch"
                ? t("solve.ready.titleScratch")
                : t("solve.ready.title")
            }
          >
            <CheckCircle2 size={13} /> {session.startingStage === "scratch" ? t("solve.readyScratch") : t("solve.ready")}
          </button>
        ) : undefined
      }
      cubeRef={cubeRef}
      hintFacelets={viewPrefs.backStickers ? "floating" : "none"}
      hintFaceletsElevation={viewPrefs.hintElevation}
      flatCubeRef={flatCubeRef}
      showFlatView={viewPrefs.flatView}
      cubeToolbar={<CaseViewToggles {...viewPrefs} />}
      cubeSetupAlg=""
      timesMs={sessionTimesMs}
      moveCounts={sessionMoveCounts}
      statsLabel={t("solve.statsLabel", { name: session.name })}
      leftAside={
        solves.length > 0 ? (
          <CompactRecentList
            title={t("solve.recent")}
            items={sortedSolves.slice(0, 25)}
            keyOf={(e) => e.record.id}
            expanded={solvesExpanded}
            onToggleExpand={() => setSolvesExpanded((v) => !v)}
            className="w-full lg:w-44 xl:w-48"
            renderRow={(e) => (
              <button
                onClick={() => setAnalysisRecord(e.record)}
                className="w-full flex items-center gap-3 py-1.5 text-left hover:bg-white/[0.03] transition-colors rounded-md px-1"
              >
                <span className="text-sm font-mono tabular-nums text-gray-600 w-9 shrink-0">#{e.nr}</span>
                <span className="text-base font-mono tabular-nums text-white flex-1">
                  {session.moveCountOnly ? t("solve.mv", { n: e.record.moveCount }) : formatTimeMs(e.record.timeMs)}
                </span>
              </button>
            )}
            expandedContent={
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-3 pb-3 shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">{t("solve.perPage")}</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => handlePageSizeChange(e.target.value === "all" ? "all" : Number(e.target.value))}
                      className="bg-gray-950/60 border border-white/10 rounded-md text-[10px] font-semibold text-gray-300 px-1.5 py-0.5 focus:outline-none focus:border-white/30"
                    >
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n === "all" ? t("solve.all") : n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="ml-auto text-[10px] text-gray-600">{t("solve.clickToSort")}</span>
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-gray-900">
                      <tr className="border-b border-gray-800">
                        <SortableTh label="#" sortKey="nr" activeKey={effectiveSortKey} ascending={sortAsc} onSort={handleSort} />
                        <SortableTh
                          label={session.moveCountOnly ? t("solve.col.moves") : t("solve.col.time")}
                          sortKey={session.moveCountOnly ? "moves" : "time"}
                          activeKey={effectiveSortKey}
                          ascending={sortAsc}
                          onSort={handleSort}
                        />
                        {!session.moveCountOnly && (
                          <SortableTh label={t("solve.col.moves")} sortKey="moves" activeKey={effectiveSortKey} ascending={sortAsc} onSort={handleSort} />
                        )}
                        {!session.moveCountOnly && (
                          <SortableTh label="TPS" sortKey="tps" activeKey={effectiveSortKey} ascending={sortAsc} onSort={handleSort} />
                        )}
                        {!session.moveCountOnly && (
                          <SortableTh
                            label={t("solve.col.fluency")}
                            sortKey="fluency"
                            activeKey={effectiveSortKey}
                            ascending={sortAsc}
                            onSort={handleSort}
                            tooltip={t("fluency.tooltip")}
                          />
                        )}
                        <th className="py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">{t("solve.col.method")}</th>
                        <th className="py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">{t("solve.col.date")}</th>
                        <th className="py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">{t("solve.col.ended")}</th>
                        <th className="py-2 w-20" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40">
                      {pagedSolves.map(({ record: s, nr }) => {
                        const fluency = session.moveCountOnly ? null : recordFluency(s);
                        return (
                          <tr
                            key={s.id}
                            onClick={() => setAnalysisRecord(s)}
                            className="relative cursor-pointer hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="py-2.5 pr-4 text-sm font-mono tabular-nums text-gray-500">#{nr}</td>
                            <td className="py-2.5 pr-4 text-base font-mono tabular-nums text-white whitespace-nowrap">
                              {session.moveCountOnly ? t("solve.mv", { n: s.moveCount }) : formatTimeMs(s.timeMs)}
                            </td>
                            {!session.moveCountOnly && <td className="py-2.5 pr-4 text-sm font-mono tabular-nums text-gray-400">{s.moveCount}</td>}
                            {!session.moveCountOnly && (
                              <td className="py-2.5 pr-4 text-sm font-mono tabular-nums text-gray-400">{s.tps.toFixed(2)}</td>
                            )}
                            {!session.moveCountOnly && (
                              <td className="py-2.5 pr-4 text-sm font-mono tabular-nums text-gray-400">
                                {fluency === null ? "—" : `${fluency}%`}
                              </td>
                            )}
                            <td className="py-2.5 pr-4 text-sm text-gray-500">{s.method}</td>
                            <td className="py-2.5 pr-4 text-sm text-gray-500 whitespace-nowrap">
                              {formatDate(s.endedAt, { month: "short", day: "numeric" })}
                            </td>
                            <td className="py-2.5 pr-4 text-sm text-gray-700 whitespace-nowrap">{formatRelativeTime(s.endedAt)}</td>
                            <td className="py-2.5">
                              <div className="relative flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMoveMenuSolveId(moveMenuSolveId === s.id ? null : s.id);
                                  }}
                                  className="shrink-0 p-1.5 text-gray-600 hover:text-gray-200 transition-colors"
                                  title={t("solve.moveToOther")}
                                >
                                  <FolderInput size={13} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirmDeleteSolveId === s.id) handleDeleteSolve(s);
                                    else setConfirmDeleteSolveId(s.id);
                                  }}
                                  className={`shrink-0 p-1.5 transition-colors ${
                                    confirmDeleteSolveId === s.id ? "text-red-400" : "text-gray-600 hover:text-red-500"
                                  }`}
                                  title={confirmDeleteSolveId === s.id ? t("solve.confirmDelete") : t("solve.delete")}
                                >
                                  <Trash2 size={13} />
                                </button>
                                {moveMenuSolveId === s.id && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-1 z-50 w-52 bg-gray-800 border border-white/15 rounded-xl shadow-2xl shadow-black/80 py-1"
                                  >
                                    <p className="px-3 py-1 text-[9px] font-bold text-gray-500 uppercase tracking-wider">{t("solve.moveToSession")}</p>
                                    {sessions
                                      .filter((x) => x.id !== s.sessionId)
                                      .map((x) => (
                                        <button
                                          key={x.id}
                                          onClick={() => handleMoveSolve(s, x.id)}
                                          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 transition-colors"
                                        >
                                          {x.name}
                                        </button>
                                      ))}
                                    <button
                                      onClick={() => {
                                        setCreateSessionForSolve(s);
                                        setMoveMenuSolveId(null);
                                      }}
                                      className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 border-t border-white/[0.06] mt-1 pt-1.5 transition-colors"
                                    >
                                      <Plus size={12} /> {t("solve.newSession")}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {itemsPerPage !== "all" && totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-2 border-t border-gray-800/40 shrink-0">
                    <button
                      onClick={() => setPage(clampedPage - 1)}
                      disabled={clampedPage <= 1}
                      className="p-1 rounded-md text-gray-500 hover:text-gray-200 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                      title={t("solve.prevPage")}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-[10px] font-mono tabular-nums text-gray-500">
                      {t("solve.page", { n: clampedPage, total: totalPages })}
                    </span>
                    <button
                      onClick={() => setPage(clampedPage + 1)}
                      disabled={clampedPage >= totalPages}
                      className="p-1 rounded-md text-gray-500 hover:text-gray-200 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                      title={t("solve.nextPage")}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            }
          />
        ) : undefined
      }
    />

    {analysisRecord && (
      <SolveAnalysis
        record={analysisRecord}
        onClose={() => setAnalysisRecord(null)}
        onUseScramble={(scramble) => {
          setAnalysisRecord(null);
          isCustomScrambleRef.current = true;
          setTarget(scramble);
        }}
        moveTargets={sessions.filter((x) => x.id !== analysisRecord.sessionId).map((x) => ({ id: x.id, name: x.name }))}
        onMoveToSession={(sessionId) => handleMoveSolve(analysisRecord, sessionId)}
        onMoveToNewSession={() => setCreateSessionForSolve(analysisRecord)}
        onDelete={() => handleDeleteSolve(analysisRecord)}
        moveCountOnly={session.moveCountOnly}
      />
    )}

    {/* Create-session-as-move-target modal — rendered last so it stacks
        above an open SolveAnalysis when triggered from its footer. */}
    {createSessionForSolve && (
      <SessionEditModal
        session={null}
        onClose={() => setCreateSessionForSolve(null)}
        onSave={(newSession) => {
          saveSession(newSession);
          onSessionsChanged();
          handleMoveSolve(createSessionForSolve, newSession.id);
          setCreateSessionForSolve(null);
        }}
      />
    )}
    </>
  );
}
