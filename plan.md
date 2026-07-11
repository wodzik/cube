# NACT — Rubik's Cube Trainer — Technical Plan

This is a rebuild of `cube_trainer`, not a from-scratch rewrite. The move-handling
core of `cube_trainer` is solid and battle-tested — it is ported, not rewritten.
The parts that grew out of control (method/phase detection, session state
duplicated three times across pages, legacy BT drivers) are consolidated or
replaced. See "What We Keep" / "What We Replace" / "What We Rewrite" below —
every decision there is justified by a concrete finding from reviewing
`cube_trainer`'s actual source, not guesswork.

---

## 1. Goals & Modes

Three modes, one shared engine:

| Mode | What it does | Persistence |
|---|---|---|
| **Solve** | Random scramble → timed solve → live CFOP/Roux stage tracking (both, in parallel) → post-solve breakdown | `solveStore` (per session) |
| **Algorithm Training** | Browse F2L/OLL/PLL cases, practice selected algorithms, per-variant timing | `algorithmStore` (per case/variant) |
| **PLL/OLL Attack** | Execute all cases of a group in order (fixed or reorderable queue), time each | `algorithmStore` + `attackStore` (session totals) |

Core requirement carried through everything: the BT cube only ever reports a
**single physical face quarter-turn** per event. All higher-level notions
(wide moves, slice moves M/S/E, rotations, R2) are things the *app* composes
from that primitive stream — never something hardware sends directly. This is
already true in `cube_trainer` and is preserved unchanged.

---

## 2. Tech Stack

Unchanged from `cube_trainer` except the hardware layer:

- React 19 + TypeScript (strict, no `any`)
- Vite 5 + `@vitejs/plugin-react`, Bun as package manager/runtime
- TailwindCSS v4 (CSS-based config, no `tailwind.config.js`)
- `cubing` (`cubing/alg`, `cubing/scramble`, `cubing/twisty`) — scramble generation, alg parsing, 3D rendering
- `recharts` — stats charts
- `@dnd-kit/core` + `@dnd-kit/sortable` — Attack queue reordering
- `lucide-react` — icons
- localStorage only, no backend

**New:** `smartcube-web-bluetooth` (`github:poliva/smartcube-web-bluetooth`) replaces the
cstimer-derived `hardware/*.js` drivers. RxJS becomes a dependency (required by
this library) — bridged into React via one hook (`useSmartCube`), not spread
across components.

---

## 3. Architectural Principles (unchanged, proven to work)

- **Pure logic, zero React**: `logic/` has no side effects, no hooks, no DOM. Trivial to unit test.
- **Adapter pattern for hardware**: hooks translate hardware/input events into
  reducer actions. No business logic in hooks.
- **Reducer is the single source of truth** for transient session state. Components never mutate state directly.
- **Components are pure display**: props in, callbacks out. No store reads inside components.
- **Persistent data lives in services** (`solveStore`, `algorithmStore`, `attackStore`), read/write localStorage, no React.

What changes in `nact` is *how many* reducers/trackers exist, not these principles.

---

## 4. What We Keep As-Is (ported from `cube_trainer`)

Verified via direct code review — these modules are correct, well-tested, and
not the source of the "did this grow out of control?" concern:

- **`moveParser.ts`** (parsing, `decomposeMove`, wide/slice decomposition tables,
  `algToPhysicalMoves`) — correct and thorough. `WIDE_CONFIG`/`SLICE_CONFIG` are
  the authoritative, verified spec for how `Rw`/`M`/`E`/`S` decompose into
  physical face turns + whole-cube rotation. Port unchanged.
- **`orientationTracker.ts`** — clean, single-purpose, correct rotation cycles. Port unchanged.
- **`scrambleTracker.ts`** logic (out-of-order opposite-face handling, partial
  power accumulation, composite move decomposition) — hard problem, solved
  correctly. Ported into the new unified **sequence tracker** (see §6.2), not
  discarded.
- **Error/repair mechanism** (`wrongMoveStack` + `simplifyMoveStack`) — the
  core idea (each new move tries to cancel the wrong-move stack; empty stack =
  repaired) is correct and stays. Only the *exposure* changes: an explicit
  `phase: "error-recovery"`-style flag instead of `wrongMoveStack.length > 0`
  checks scattered in components.
- **Statistics** (`wcaAverage`, `ao5/12/100`, `formatTimeMs`) — no issues found, port unchanged.
- **Algorithm JSON data** (`formatted_f2l.json`, `formatted_oll.json`, `formatted_pll.json`) — port as-is.
- **`AlgorithmVariant`/`AlgorithmCase` model + per-variant `times[]`/`ao5`/`ao12`/`bestTime`** — already correct, port unchanged.
- **`TrainerPanel` layout shell concept** — the 3-column responsive layout
  shared by Solve/Training/Attack already exists and is the right idea. Port
  and strengthen it (see §9).

---

## 5. What We Replace: Hardware Layer

`cube_trainer/src/hardware/*.js` is ~3100 lines of modified cstimer code
(marked "legacy, do not modify" in its own CLAUDE.md — a red flag on its own),
untested, driver-per-brand with no shared abstraction.

**Replace with `smartcube-web-bluetooth`:**

| | Legacy (`hardware/*.js`) | `smartcube-web-bluetooth` |
|---|---|---|
| Brands | GAN, Giiker, GoCube, QiYi, MoYu (incl. v32) | Same set + XMD Tornado V4 |
| Language | Plain JS, no types | TypeScript, full types |
| Tests | None | 24 test files, incl. real-device replay captures |
| API | Ad-hoc callbacks, one shape per driver | RxJS `Observable`, one unified `MOVE {face, direction}` event for all brands |
| License | Derived from cstimer, unclear | MIT |

Integration: one hook, `useSmartCube()`, subscribes to `connectSmartCube()`'s
`events$`, maps `MOVE` events to move strings (`"R"`, `"R'"`), and calls
`dispatch(CUBE_MOVE)` — same adapter contract the reducer already expects.
Battery/disconnect events map to existing `DeviceConnection` state. No change
needed in `moveParser`/sequence tracker/reducer — they already only consume
plain move strings.

---

## 6. What We Rewrite / Consolidate

Four concrete problems found in `cube_trainer`, each with a specific fix.

### 6.1 Unified session state machine

**Problem found:** three independent, hand-rolled phase machines doing the
same job — `sessionReducer.ts` (proper reducer, Solve mode only),
`TrainingPage.tsx` local `useState`/`useRef` (`DrillPhase`, explicitly *not*
using the session provider), and `AttackPage.tsx` local state (`AttackPhase`,
a *third* enum, using yet another progress engine — `CubeSim` — instead of
`AlgorithmTracker` directly like TrainingPage does). Spacebar handling is
reimplemented a third time as an inline `keydown` listener in `AttackPage`.

**Fix:** one reducer, one `SessionState` shape, used by all three pages.

```ts
type Mode = "solve" | "algorithm" | "attack";

type Phase =
  | "idle"
  | "setup"        // scrambling (solve) OR showing the target algorithm (algorithm/attack)
  | "ready"
  | "inspecting"   // optional, mostly solve mode
  | "active"        // free solving (solve mode) OR executing a known sequence (algorithm/attack)
  | "done";

interface SessionConfig {
  mode: Mode;
  startMethod: "cube-move" | "spacebar" | "timer-device";
  stopMethod: "cube-solved" | "spacebar" | "timer-device";
  useInspection: boolean;
  inspectionSeconds: number;
}
```

`setup` and (for algorithm/attack) `active` both delegate to the **same**
sequence tracker (§6.2) — the only mode-specific difference is what `target`
sequence populates it (random scramble vs. selected algorithm vs. current
attack-queue case). Solve mode's `active` phase is the only place using
free-form tracking (`isSolved()` polling, no known target).

`startMethod`/`stopMethod` triggers (`useCubeDevice`, `useSpacebar`,
`useTimerDevice`) are the *only* place start/stop signals originate — no
inline `keydown` handlers in page components.

### 6.2 Unified sequence tracker

**Problem found:** `scrambleTracker.ts` and `algorithmProgress.ts`
(`AlgorithmTracker` class) solve the identical problem — match incoming moves
against a known target sequence, accumulate partial power, detect wrong
moves, build a repair sequence, know when the sequence is fully executed —
via two separate implementations. `AttackPage` then uses a *third* variant
(`CubeSim`, which itself wraps something) instead of reusing either.

**Fix:** one `sequenceTracker.ts` module, config-driven:

```ts
function processSequenceMove(
  move: string,
  target: string[],
  trackerState: SequenceTrackerState,
): SequenceMoveResult;
```

Used identically for: scrambling (target = scramble), algorithm execution
(target = selected algorithm's physical moves via `algToPhysicalMoves`), and
attack mode (target = current queue case's algorithm). One engine, three
callers, zero duplication. `AttackPage`'s `CubeSim` facade is deleted.

### 6.3 Method detection: shared cube state + pluggable stage detectors

**Problem found:** `cfopAnalysis.ts` (1016 lines) + `cfopAnalysisNew.ts` (566
lines, an abandoned duplicate) + `rouxAnalysis.ts` (908 lines) — each
maintains its **own full facelet-level cube simulation** (duplicated
`FACE_DEFINITIONS`, corner/edge index tables) instead of sharing one. ~1600
lines of near-literal duplication.

**Fix, and this directly satisfies "track CFOP and Roux in parallel without
overwriting":**

```ts
// One shared, incrementally-updated facelet-level state (built on the
// existing cubeStateSimulator.ts — that part was fine, just needs to stop
// being duplicated per method).
class LiveCubeState {
  applyMove(move: string): void;
  getPattern(): FaceletState;
}

// A method = an ordered list of stages + a stateless predicate per stage.
interface StageDetector {
  method: "CFOP" | "Roux";
  stages: readonly string[];              // e.g. ["cross","f2l-1",...,"pll"]
  isStageSolved(stage: string, state: FaceletState): boolean;
}

// Boundaries only — no move duplication.
interface StageBoundary {
  stage: string;
  moveIndex: number;
  timestampMs: number;
}
```

After every move: update `LiveCubeState` **once**, then run every configured
`StageDetector` against it (cheap — each is a handful of sticker comparisons,
checking only the *next expected* stage, not rescanning from scratch). Each
detector appends to its own `StageBoundary[]` — CFOP and Roux run
side-by-side, permanently, neither overwrites the other. Adding a third
method (ZZ, Petrus, ...) later is a new `StageDetector` config, zero changes
elsewhere.

`SolveRecord` stores both boundary lists (§7.1). Per-stage move lists /
recognition-execution splits are *derived* on demand by slicing the raw move
log against a boundary list (same mechanism `computeStageSplits` already
uses) — never stored pre-computed/duplicated.

`method` (the headline stat on a solve) is either user-declared, or a simple
post-solve heuristic (which detector completed a coherent, in-order stage
sequence) — not a live decision the engine has to commit to, since both are
tracked regardless.

### 6.4 Fix move-reduction for solve display/counting

**Problem found:** `reduceSolvingMoves()` in `moveParser.ts` is documented as
"for tracking moves DURING SOLVE" but its own example proves it does the
*wrong* thing for that purpose: `reduceSolvingMoves(["U", "U'"]) → []` — it
cancels adjacent inverse pairs. For solve move-counting we explicitly do
**not** want that: `R` then `R'` are two distinct real turns and must stay as
two separate entries. Only literally-repeated identical moves collapse:
`R, R → R2`. This also means `computeStageSplits`'s per-stage
`reducedStepCount` is currently *undercounting* moves whenever a solve
contains an inverse-pair turn.

**Fix:** new function, narrower rule than every existing reducer:

```ts
/**
 * Collapse only maximal runs of literally-identical consecutive move tokens.
 * R,R → R2. R,R' does NOT merge (different tokens) — stays as two moves.
 * This is intentionally NOT algebraic cancellation (unlike simplifyMoveStack,
 * used for scramble/algorithm tracking, where R,R' → [] is correct).
 */
function collapseIdenticalMoves(moves: string[]): string[];
```

Used for: `SolveRecord.reducedMoves` / `moveCount` / `tps`, and replaces
`reduceSolvingMoves` inside `computeStageSplits`. `simplifyMoveStack` /
`reduceMoves` keep their existing algebraic-cancellation behavior — they're
correct for what they're used for (scramble/algorithm wrong-move detection)
and must **not** be reused here.

---

## 7. Data Model

### 7.1 `SolveRecord` (replaces `Solve` in `solveStore.ts`)

```ts
interface SolveRecord {
  id: string;
  sessionId: string;

  // Context
  method: "CFOP" | "Roux" | "unknown";
  startMethod: "cube-move" | "spacebar" | "timer-device";
  stopMethod: "cube-solved" | "spacebar" | "timer-device";

  // Timing
  timerStartedAt: number;            // performance.now() baseline
  firstMoveAt: number | null;
  timeToFirstMoveMs: number | null;  // firstMoveAt - timerStartedAt
  endedAt: number;
  timeMs: number;

  // Scramble — starting state
  scramble: string;
  scrambleMoves: string[];

  // Moves
  moves: MoveRecord[];        // full raw log, one entry per physical quarter-turn, timestamped (unchanged shape from cube_trainer)
  reducedMoves: string[];     // via collapseIdenticalMoves (§6.4) — for display + counting
  moveCount: number;          // reducedMoves.length
  tps: number;

  // Method tracking — both always present, independent, non-destructive (§6.3)
  cfop: StageBoundary[];
  roux: StageBoundary[];

  isDNF: boolean;
}
```

### 7.2 `AlgorithmCase` / `AlgorithmVariant` — unchanged from `cube_trainer`

Per-variant `times: number[]`, `ao5`/`ao12`/`ao100`/`bestTime`, `learningStatus`. No changes needed.

### 7.3 Backlog (explicitly deferred, per user request)

- **Per-case aggregate view**: across all variants of a case, show combined
  average time + total execution count. Partially derivable today from
  existing `times[]`/`computeVariantStats` per variant — needs a rollup
  function + a UI list, not a data model change. Not in v1 scope.

### 7.4 `AttackSession` — unchanged from `cube_trainer` (`attackStore.ts`)

---

## 8. State Architecture

```
┌──────────────┐   MOVE events (RxJS)   ┌─────────────────┐
│ smartcube-web-│───────────────────────▶│ useSmartCube()  │
│ bluetooth     │                        │ (adapter hook)  │
└──────────────┘                        └────────┬────────┘
                                                   │ dispatch(CUBE_MOVE)
┌──────────────┐                                  ▼
│ useSpacebar   │─────────dispatch(START/STOP)──▶┌─────────────────────┐
│ useTimerDevice│                                 │  sessionReducer      │  ← ONE reducer, §6.1
└──────────────┘                                 │  (pure function)     │
                                                   └──────────┬───────────┘
                                                              │ delegates to
                                    ┌─────────────────────────┼─────────────────────────┐
                                    ▼                         ▼                          ▼
                          sequenceTracker (§6.2)    LiveCubeState + StageDetectors (§6.3)   selectors
                          (scramble / algorithm)     (CFOP + Roux, parallel, always on)
                                    │                         │                          │
                                    └─────────────┬───────────┘                          │
                                                   ▼                                      ▼
                                          SessionState (Context)  ──────────────▶  TrainerPanel + shared components
                                                   │
                                                   ▼ on phase → "done"
                                    solveStore / algorithmStore / attackStore (localStorage)
```

---

## 9. UI Architecture — Shared Components

Explicit goal (per requirements): **one outer shell, one shared component
set; only the inner wiring differs per mode.** `cube_trainer` already had the
right idea with `TrainerPanel`/`TrainLayout` — this formalizes and completes
it. Now that state is unified (§6.1/§6.2), the three mode "pages" become thin
controllers that feed the same shell with different data — not three
independently-built UIs.

### 9.1 The shell

```
TrainerPanel
├── header        → mode-specific (SessionPanel for Solve, group tabs for Training/Attack)
├── sequence       → MoveSequenceDisplay (identical component for scramble / algorithm / attack alg)
├── centerTop      → mode-specific text (session name / case name / attack progress)
├── center         → TimerDisplay + SolveControls (identical everywhere)
├── cube           → CubeVisualisation (identical everywhere)
├── stats          → StatsChart (identical everywhere, different data feed)
└── bottom         → mode-specific (SolvesTable+SessionPanel / AlgorithmListView / DnD queue)
```

Every page (`SolvePage`, `TrainingPage`, `AttackPage`) is a controller that:
1. configures `SessionConfig.mode`,
2. sets the `target` sequence for the sequence tracker,
3. maps `SessionState` → props for the shared components above.

No page reimplements timer logic, move display, or cube rendering.

### 9.2 Component inventory

**Fully shared, mode-agnostic (built once, used everywhere):**
- `TrainerPanel` — layout shell (delete the older, now-redundant `TrainLayout` after confirming nothing still imports it)
- `MoveSequenceDisplay` — scramble/algorithm progress strip, driven purely by `moves[]` + progress props
- `CubeVisualisation` — TwistyPlayer wrapper, imperative ref API (`reset`, `addMove`, `setSetupAlgorithm`, `isSolved`)
- `TimerDisplay` — formatted time, state-colored
- `StatsChart` — recharts time series (single/Ao5/Ao12), fed different data per mode
- `ConnectionPanel` — BT cube + timer connect/disconnect (lives in app shell/header, not per-page)
- `SolveControls` — cancel/reset buttons

**Generalized (were CFOP-specific, now parameterized by `StageDetector`, per §6.3):**
- `StageProgress` (was `CFOPProgress`) — live stage bar, takes `stages: string[]` + `completedStages` — can render CFOP and Roux bars side by side
- `StageBreakdown` (was `CFOPBreakdown`) — post-solve recognition/execution table, same generalization

**Shared across Training + Attack (case browsing):**
- `AlgorithmListView`, `CaseCard` / `CaseListItem`, `CaseEdit`

**Mode-specific (small, thin, live in `pages/`):**
- `SessionPanel` (Solve only — session CRUD)
- `SolvesTable` (Solve only) — consider generalizing into a reusable `HistoryTable` shared with Attack's session list, if the column shapes end up compatible; evaluate during implementation, not a hard requirement upfront
- Attack's DnD queue (`SortableQueueItem`, drag context) — Attack only

### 9.3 What we do NOT build

- No separate CSS/layout per mode — Tailwind utility classes only, shared `TrainerPanel` handles all layout responsibility.
- No mode-specific timer/move-log implementations — see §6.1.
- No second facelet-simulation engine — see §6.3.

---

## 10. Directory Structure

```
src/
├── types/
│   ├── session.ts          # Mode, Phase, SessionConfig, SessionState, MoveRecord
│   ├── cube.ts              # Face, Orientation, FaceletState
│   ├── hardware.ts          # DeviceConnection, CubeDeviceType
│   ├── algorithm.ts         # AlgorithmCase, AlgorithmVariant, LearningStatus
│   └── solve.ts             # SolveRecord, StageBoundary
│
├── algs/                    # formatted_f2l.json, formatted_oll.json, formatted_pll.json (ported)
│
├── services/
│   ├── solveStore.ts        # SolveRecord + StoredSession CRUD
│   ├── algorithmStore.ts    # AlgorithmCase progress CRUD
│   └── attackStore.ts       # AttackSession CRUD
│
├── logic/
│   ├── moveParser.ts             # ported unchanged
│   ├── orientationTracker.ts     # ported unchanged
│   ├── sequenceTracker.ts        # NEW — merges scrambleTracker + algorithmProgress (§6.2)
│   ├── moveReduction.ts          # collapseIdenticalMoves (§6.4) + simplifyMoveStack/reduceMoves (ported)
│   ├── cubeStateSimulator.ts     # ported, now the ONLY facelet simulator (§6.3)
│   ├── stageDetection/
│   │   ├── liveCubeState.ts      # wraps cubeStateSimulator, incremental
│   │   ├── cfopStages.ts         # StageDetector config for CFOP
│   │   ├── rouxStages.ts         # StageDetector config for Roux
│   │   └── methodTracker.ts      # generic engine: state + detectors → StageBoundary[]
│   └── statistics.ts             # ported unchanged
│
├── state/
│   ├── sessionActions.ts
│   ├── sessionReducer.ts    # ONE reducer for all 3 modes (§6.1)
│   ├── sessionContext.tsx
│   └── sessionSelectors.ts
│
├── hooks/
│   ├── useSmartCube.ts      # NEW — RxJS bridge to smartcube-web-bluetooth (§5)
│   ├── useTimerDevice.ts
│   ├── useSpacebar.ts
│   ├── useSolvedDetection.ts
│   ├── useScrambleGenerator.ts
│   └── useAnimationTimer.ts
│
├── components/
│   ├── TrainerPanel.tsx
│   ├── MoveSequenceDisplay.tsx
│   ├── CubeVisualisation.tsx
│   ├── TimerDisplay.tsx
│   ├── StatsChart.tsx
│   ├── ConnectionPanel.tsx
│   ├── SolveControls.tsx
│   ├── StageProgress.tsx     # generalized CFOPProgress
│   ├── StageBreakdown.tsx    # generalized CFOPBreakdown
│   ├── SessionPanel.tsx
│   ├── SolvesTable.tsx
│   ├── AlgorithmListView.tsx
│   ├── CaseCard.tsx
│   └── CaseEdit.tsx
│
├── pages/
│   ├── SolvePage.tsx        # thin controller
│   ├── TrainingPage.tsx     # thin controller
│   ├── AttackPage.tsx       # thin controller
│   └── SettingsPage.tsx
│
├── App.tsx
└── main.tsx
```

---

## 11. Execution Plan

1. **Scaffold**: Vite + React 19 + TS + Tailwind v4 + Bun, port `types/`, `algs/` JSON, `logic/moveParser.ts`, `logic/orientationTracker.ts`, `logic/statistics.ts` unchanged. Port their existing unit tests.
2. **Hardware layer**: add `smartcube-web-bluetooth`, build `useSmartCube`, verify move events end-to-end against a real cube before building anything on top.
3. **Sequence tracker** (§6.2): build `sequenceTracker.ts` from `scrambleTracker.ts` + `algorithmProgress.ts` logic, unit-test heavily (this + move reduction are the highest-value test targets given past bugs found).
4. **Move reduction fix** (§6.4): `collapseIdenticalMoves`, unit tests asserting `R,R'` stays 2 moves and `R,R` → `R2`.
5. **Unified session reducer** (§6.1): one reducer/config for all 3 modes.
6. **Shared UI shell** (§9): `TrainerPanel` + fully-shared components, wired to the new reducer.
7. **SolvePage** end-to-end on the new stack (scramble → solve → save `SolveRecord`).
8. **Method detection** (§6.3): `LiveCubeState` + `cfopStages`/`rouxStages` + `methodTracker`, wire into `StageProgress`/`StageBreakdown`.
9. **TrainingPage + AttackPage** as thin controllers over the same reducer/tracker — should require noticeably less new code than in `cube_trainer` since the state/tracking layer is already shared.
10. **Stores**: `solveStore`, `algorithmStore`, `attackStore` — port with `SolveRecord` shape update.
11. **Settings, polish, cross-browser BT check** (Chrome/Edge/Opera primary; Web Bluetooth constraint carried over from `cube_trainer`).

---

## 12. Explicit Non-Goals (v1)

- Per-case aggregate algorithm summary (§7.3) — backlog.
- Additional methods beyond CFOP/Roux (ZZ, Petrus, ...) — architecture supports adding them cheaply later (§6.3), not built now.
- Backend/sync — localStorage only, same as `cube_trainer`.
- Auto method-detection as a hard live decision — both methods tracked always; `method` label is heuristic/user-declared, not load-bearing for the engine.
