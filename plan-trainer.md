# NACT — Case Trainer (Cross / XCross / Pair / …) — Technical Plan

Goal: replicate the capabilities of or18's RubiksSolverDemo trainers
(cross_trainer, xcross_trainer, pairing_trainer, …) inside nact, and go
beyond them by using what nact already has and the reference site doesn't:
a smart cube. The trainer must show **how many moves the user actually
needed vs. the optimal count**, and flag non-optimal solves — the user is
not forced to follow an optimal solution, but gets told when they exceeded
it.

---

## 1. How the reference trainer works (verified from source)

Two independent WASM engines per trainer page:

### 1.1 Scramble generator (`src/xcrossTrainer/solver.cpp`, ~570 lines)

- On init builds move tables + a BFS pruning table over the target subgroup
  (xcross = 5 edges × 1 corner ≈ 73M states; this is the "700 MB locally"
  warning on the page — tables are built in RAM on first use, takes seconds).
- Crucially it also keeps `index_list[d]` — **every state indexed by its
  exact optimal depth d**. Generating an "optimal = N" scramble is:
  1. Pick a uniformly random state `X` from `index_list[N-1]` → its optimal
     xcross solution is exactly N moves *by construction*.
  2. Take a random full-cube state `R` (min2phase.randomCube), solve its
     xcross (solution `A`).
  3. Compose: `solution(X) · inverse(scramble(R) · A) · slotRotation` — a
     full random-looking cube whose cross+slot part sits exactly at state X.
  4. min2phase solves the composed state → clean ~20-move scramble string.
- Result: random cube, random everywhere except the trained pieces, optimal
  solution for the trained target is **exactly N** — no rejection sampling.

### 1.2 Optimal-solutions solver (`src/crossSolver/worker.js` + WASM)

- Streaming IDA*: posts solutions one message at a time (up to 100), plus
  `depth = k` progress messages. Supports move restrictions, premoves,
  pseudo center offsets, rotation-move penalties.
- The page renders each streamed solution on a masked TwistyPlayer
  (`experimentalStickeringMaskOrbits` — only cross+slot stickers visible).

### 1.3 Page capabilities (feature parity checklist)

- Trainer types: Cross, XCross, XXCross, Free Pair, XCross+Free Pair,
  Pseudo XCross, Pseudo Free Pair, EOCross (one WASM dir each, same shape).
- Config: rotation (how you hold the cube), slot (BL/BR/FR/FL), optimal
  length N (1–10 for xcross, 1–8 for cross).
- Next / Back (one-deep scramble history).
- Masked cube preview of the scramble.
- "Solve" → streamed list of optimal solutions, each with masked player +
  alg.cubing.net / cubedb.net links.
- Advanced: move restrict (allowed move set), premove, ignore-premove-center.

**License note:** RubiksSolverDemo is **GPL-3.0**. Vendoring its WASM/JS
makes nact a derivative work — fine while nact is private; if it's ever
distributed, the app source must be released under GPL-3. Decision point
below (§3) keeps the GPL surface isolated so it can be swapped later.

---

## 2. What nact already has that the plan builds on

| Need | Already in nact |
|---|---|
| Scramble tracking while user mixes the cube | `sequenceTracker` + phase `"setup"` (with live error/repair) |
| Timed attempt state machine | `sessionReducer` (idle→setup→ready→active→done) |
| Physical move log + true move counting | `moveLog` + `collapseIdenticalMoves` (R,R→R2; R,R' stays 2) |
| Stage predicates, face-agnostic | `lastLayerShared.ts`: `isCrossSolvedOnFace`, `detectCrossFace`, `FACE_SLOTS`, `MIDDLE_LAYER_EDGE_SLOTS`, `isSlotSolved` |
| Incremental cube state from moves | `LiveCubeState` (kpuzzle) + `StageWalker` pattern (`useMethodProgress`) |
| Masked/stickered 3D preview | `TrainerPanel`/`CubeVisualisation` `stickering` prop (+ kpuzzle mask orbits if named stickerings don't cover cross+slot) |
| Scramble from arbitrary state | `cubing/search` `experimentalSolve3x3x3IgnoringCenters(pattern)` — replaces min2phase entirely |
| Random full-cube state | `randomScrambleForEvent("333")` (already used) |
| Per-mode page shell | `TrainerPanel` + thin controller page pattern |
| Persistence pattern | `solveStore`/`algorithmStore`/`attackStore` → new `trainerStore` |

The single genuinely new mechanic: **stop on "target stage solved" instead
of "cube fully solved"**, plus the scramble generator itself.

---

## 3. Scramble generation — decision

Two viable routes; recommendation is the hybrid:

- **Cross (and EOCross later): native TypeScript port.** The cross subgroup
  is tiny (12P4 × 2⁴ = 190,080 states; EOCross ≈ 190,080 × 2⁷). Full BFS +
  depth-indexed state lists build in <100 ms in a worker with typed arrays.
  Port `solver.cpp`'s indexing scheme (it's compact and self-contained).
  No GPL binary, and it unlocks the wasted-move analyzer (§7.3) for free
  because we get a `distanceToSolved(state)` query.
- **XCross / XXCross / Free Pair / Pseudo: vendor the prebuilt or18 WASM
  workers** into `public/trainers/<type>/` (classic workers, loaded by URL —
  no bundler integration needed, exactly how the reference site runs them).
  These need the big tables (xcross ~360 MB RAM); re-porting them to TS
  buys nothing since memory cost is identical. Isolate behind one typed
  service so a future clean-room replacement is a drop-in.

Composition step (shared, TS, replaces min2phase + `functions.js`):

```
randomScrambleForEvent("333")            → R (random state, as alg)
trainerWorker(R, N)                      → A (solution of R's target), B (solution of depth-N state X)
pattern = apply(solved, B · inv(R·A) · slotRot)   // kpuzzle, pure TS
scramble = experimentalSolve3x3x3IgnoringCenters(pattern)
```

Everything lives in `src/services/trainerScrambleService.ts`:

```ts
type TrainerType = "cross" | "xcross" | "xxcross" | "pair" | "eocross" | ...;
interface TrainerScrambleRequest { type: TrainerType; slot: Slot; length: number; rotation: string }
interface TrainerScramble { scramble: string; optimalLength: number; request: TrainerScrambleRequest }
generateTrainerScramble(req): Promise<TrainerScramble>
```

Worker lifecycle: lazy-create on first request per type, keep alive
(table build is the expensive part), init-progress callback for the UI
("building tables… first run takes a while").

## 4. Optimal-solutions solver

Vendor `src/crossSolver/` worker the same way (it covers cross AND xcross
via its `slot` arg; other types have their own solver dirs). Wrap in:

```ts
// src/services/optimalSolutionsService.ts
solveOptimal(req: { scramble: string; type: TrainerType; slot: Slot },
             onSolution: (alg: string, index: number) => void,
             onDepth: (d: number) => void): { cancel(): void }
```

Streamed straight into the results list; cancel on unmount/Next. For the
cross trainer the TS engine can serve this too (IDA* over 190k states is
trivial), so Phase 1 needs no WASM at all.

Note: we do NOT need the solver to know the optimal length — it's `N` by
construction from generation. The solver is only for *showing* solutions.

---

## 5. Trainer session flow (new page: `pages/CaseTrainerPage.tsx`, new tab "Trainer")

Thin controller over the existing `SessionProvider`, `mode: "solve"`
semantics with one extension:

1. **Config bar** (header): trainer type · slot(s) · target length N ·
   rotation · Next/Back. Persisted in localStorage (last-used config).
2. **Generate** → `TrainerScramble`; scramble shown in `MoveSequenceDisplay`,
   masked cube preview (only trained pieces colored). User scrambles the
   physical cube tracked by the sequence tracker — wrong-move repair
   included (already a big UX win over the reference site's plain text).
3. **ready → active**: existing start methods (first cube move; optional
   inspection) — unchanged reducer behavior.
4. **Stop condition — the one new mechanic.** New hook
   `useStageSolvedDetection(state, predicate)`: incrementally applies
   `moveLog` (scramble + solve moves) to a `LiveCubeState` (same walker
   pattern as `useMethodProgress`) and dispatches the stop action when
   `predicate(state)` becomes true during `"active"`.
   Predicates from existing shared helpers, face-agnostic:
   - cross: `detectCrossFace(state) !== null`
   - xcross: cross face F solved ∧ ≥1 F2L slot of F solved
   - xxcross: ∧ ≥2 slots; pair: cross pre-solved? (pair trainer: cross+3
     slots given, detect 4th) — per-type predicate table in
     `logic/stageDetection/trainerTargets.ts`.
   Reducer change: add `"stage-solved"` to `StopMethod` (a one-line union
   extension; dispatch path identical to `cube-solved`).
5. **Done — the verdict.** Immediately (no solver run needed):
   - your moves `M` = `collapseIdenticalMoves(solveMoves).length`, time, TPS
   - optimal `N` (known from generation)
   - badge: `M === N` → **"Optimal!"**; else **"+{M−N} moves over optimal"**
     (amber), with both numbers shown.
   - actions: **Show optimal solutions** (streams §4 into masked players),
     **Retry same scramble**, **Next scramble**.
6. **Persist** to `trainerStore`:

```ts
interface TrainerAttempt {
  id: string; endedAt: number;
  type: TrainerType; slot: Slot; targetLength: number; rotation: string;
  scramble: string;
  timeMs: number; moves: MoveRecord[]; moveCount: number;
  optimalLength: number; overhead: number;      // moveCount - optimalLength
  solvedFace: Face; solvedSlots: number;        // what was actually detected
  isDNF: boolean;
}
```

7. **Stats panel** (reuse `StatsChart` + small tiles): % optimal, mean
   overhead, ao12 of time, filtered by (type, N) — the pair that defines a
   difficulty class.

Detection caveat to handle explicitly: `isSlotSolved` is relative to the
scramble's reference frame; physical whole-cube rotations by the user are
invisible to the smart cube's face-turn stream, which is exactly why all
predicates stay face-agnostic (check all 6 faces), same as `cfopStages`.

---

## 6. Execution phases

1. **Phase 1 — Cross trainer MVP, zero WASM.** ✅ DONE. TS cross engine
   (BFS tables + depth-indexed sampling + exact-distance solution DFS —
   fast enough on the main thread, no worker needed);
   `trainerScrambleService`; `useStageSolvedDetection` +
   `"stage-solved"` StopMethod; `CaseTrainerPage` + tab; verdict UI;
   `trainerStore` + stats. End-to-end proof of the whole loop.
   Design change made during implementation: scrambles are generated
   **from the cube's current physical state** (tracked as a
   KTransformation over every hardware move), because a cross attempt
   ends with the cube unsolved — no restore-to-solved between attempts.
   Consequences: the session must start from a solved cube ("Resync"
   button re-declares solved), and the wasted-move analyzer (§7.3)
   shipped in phase 1 since the engine made it ~free. Retry-same-scramble
   was dropped (would need target-state-pinned regeneration; revisit in
   phase 4). Dev-only `window.__nactSimulateMove` on SmartCubeProvider
   lets headless tests drive the full loop without hardware.
2. **Phase 2 — XCross.** ✅ DONE. Vendored or18 xcross WASM worker
   (public/trainers/xcross/, GPL note in public/trainers/README.md, all
   access isolated in src/services/xcrossWorkerClient.ts). Native frame
   calibrated empirically: the engine targets the D cross + BL slot; other
   slots are reached by ROTATION CONJUGATION of C₀'s tokens into the app
   frame (src/logic/trainer/xcrossFrames.ts — face relabeling derived from
   kpuzzle at runtime, slot table verified by unit tests). App trains the
   white (U-face) cross + chosen slot, consistent with phase 1.
   Verification per scramble: piece-exact match against the intended end
   state (ignoring center twist) + an independent WASM re-solve confirming
   optimal length == N, which doubles as the verdict's example solution.
   XCross verdicts skip the wasted-move breakdown (no cheap distance query
   in the WASM); worker builds ~600 MB tables on first use (~8 s on Apple
   Silicon), init hint shown, singleton kept alive. Back button and
   streamed multi-solution players dropped (from-state generation replaced
   the former; single example solution suffices until phase 3's
   crossSolver vendoring).
3. **Phase 3 — remaining types.** ✅ DONE (2026-07-15): XXCross, Free Pair,
   EOCross — all via vendored or18 WASM engines behind the generalized
   `or18TrainerWorkers.ts` client (per-engine lazy singleton lanes,
   serialized requests; xxcross runs two instances, adjacent/opposite).
   Calibrated native frames: eocross = D cross + EO (rot "z2", kpuzzle EO
   convention verified F/B-axis-compatible); xxcross-adj = D + {BL,BR},
   xxcross-opp = D + {FR,BL} (6-pair rotation table in xcrossFrames.ts);
   pairing = same frame as xcross, but a 17-STATE GOAL SET ("pair formed,
   one insert away" — extraction algs × AUFs read from its prune seeding),
   detected by piece-placement signatures (pairingGoals.ts). Pairing's C₀
   routes through the inserted frame using the engine's 4-part response
   (B·applB⁻¹·applA·A⁻¹·R⁻¹). NOT done from the original phase-3 list:
   XCross+Free Pair combo, pseudo variants, move-restrict/premove advanced
   settings — moved to backlog (§8).
4. **Phase 4 — polish/extras.** ✅ DONE (2026-07-15):
   - **Hint on demand** (§7.8, upgraded): reveals the first move of an
     optimal solution from the cube's CURRENT mid-attempt state — the TS
     engine answers for cross, the WASM engines re-solve the conjugated
     live state for the rest. Attempt gets a `hintUsed` badge.
     Extended later with **Reveal solution**: full optimal solution(s) from
     the current state (cross/roux enumerate several, WASM types return
     one), shown in the center panel and kept visible while the user
     follows along; also flags `hintUsed`.
   - **Retry case** (§7.7, scaled down from a queue to a button): pinned
     regeneration — a fresh scramble from wherever the cube is now that
     reproduces the EXACT same target sub-state (cross pins the engine
     state; WASM types pin the stored native target solution, pairing also
     its appl companion). Available from the verdict and history rows.
   - **Ladder mode** (§7.5): opt-in; raises the optimal length by 1 once
     the last 10 attempts at the current level are ≥80% optimal.
   - **Closest optimal** (§7.4): non-optimal cross verdicts show the
     optimal solution sharing the longest prefix with the user's line,
     divergence point highlighted. (Cross only — needs full enumeration.)

---

## 6.5 Phase 5 — Roux trainers ✅ DONE (2026-07-15)

Shipped: Roux FB (levels 3–8, x-orientation-neutral) + Roux SS front/back
(levels 3–10, FB-solved setups), per the assessment below. Implementation
notes vs the assessment:
- Vendored lib lives in src/vendor/roux (README + LICENSE there; min2phase
  CJS→ESM was the only functional edit). NO worker needed — FB pruner init
  199 ms, solves ~1 ms, min2phase 616 ms init / 179 ms per generator;
  rejection sampling ≲100 ms at every offered level (deeper levels don't
  exist: x-neutral FB maxes at 8, SS at 10 — measured distributions peak
  6–7).
- Generation: sample state with their masks → min2phase generator sequence
  → shared composeScramble (extracted to services/trainerCompose.ts) with
  c = invert(gen). Retry pin = the stored generator (targetGenerator).
- STM verdicts via collapseToStm (moveReduction.ts): merges reported
  opposite-face complementary pairs into M/E/S. E2e proof: an SS solution
  "R' U M2 U r U' R2" (7 STM) executed as 11 reported face turns scored
  "Optimal!"; hints conjugate premove-frame moves into physical tokens via
  a kpuzzle-derived alphabet map.
- Detection reuses rouxStages' x^k offset machinery (exported), which is
  simultaneously M-move reporting tolerance AND x-neutrality — verified
  against vendored-solver solutions in rouxTargets.test.ts.

### Original assessment (for reference)

Assessed 2026-07-15 against ~/Desktop/cube/roux-trainers (GPL-3.0, React +
**pure-TypeScript solver library** — src/lib/{CubeLib,Pruner,Solver}.tsx,
~2.7k lines): FB / FBDR / FS / SS / FBSS / LSE / EOLR solvers with Roux
movesets (M and r are first-class = STM-optimal solutions), IDA + depth-5
pruning tables (small, ~1-3 s init, no 600 MB WASM), and level filtering by
REJECTION SAMPLING with a pruner lower-bound pre-check (their
BlockTrainerStateM.getRandom, levelMaxAttempt 1000-2000).

Verdict: fits our architecture BETTER than or18 did.

- **Generation** degenerates to the simple case of our composition: the
  rejection loop yields the whole target state as a random scramble R
  (optionally + a stage prefix, e.g. SS setups = R·A_fb with A_fb from
  their FB solver), so c = invert(R·A…) — sequences as lingua franca, no
  CubieCube↔KPattern conversion anywhere. Verification identical
  (piece match + independent re-solve length check).
- **Detection**: nact's rouxStages.ts ALREADY solves the hard part —
  block predicates with the M-move x^k rotation-offset tolerance (smart
  cubes report M as an L + opposite R pair, leaving blocks rotated vs
  centers in the fixed frame). Reuse isBlockSolved/offsetStates for the
  trainer's stage-solved predicates (FB: either block; SS: both, shared k).
- **Deployment**: vendor src/lib into a Vite MODULE worker (pure TS — no
  classic-worker/WASM plumbing). Same GPL-3 isolation policy as
  public/trainers (one service entry point).

New problems to solve (none blocking):
- **STM move counting**: a physical M arrives as TWO reported face turns
  (L + R'), while the solver's optimum counts it as 1 (STM). Verdict needs
  a collapseToStm pass merging adjacent opposite-face inverse pairs into
  slice moves; wide r arrives as a single reported turn and already counts
  1. Without this every M costs the user a phantom +1.
- **Orientation neutrality**: their FB optimum is min over x/x'/x2
  premoves — adopt the same convention so verdicts match what a human can
  actually achieve; detection is already orientation-tolerant.
- **Rare levels** cost more rejection tries (bounded by their own
  production-tested limits + pruner pre-check).

Scope: FB trainer (levels ~3–10) + SS front/back (FB-solved setups),
FBDR as stretch. Hint/retry/ladder come free from phase-4 infra (retry
pinning is trivially the stored generator sequence). Wasted-move analysis
possible async via per-prefix re-solves (~tens of ms each) — stretch.

UPDATE (same day): the stretch shipped too — **FS** (first square,
front/back, x-neutral like FB, levels 2–6) and **FBDR** (FB + DR edge from
an FS-solved scramble, "solved FS" side picker, fixed frame, levels 2–7),
via the generalized sampleCase/solverFor/premovesFor paths in
rouxTrainerService. The trainer page also gained **family tabs**
(CFOP | Roux) filtering the type buttons, with last-used type remembered
per family and per-type side pickers (ss/fs/fbdr).

## 7. Improvement ideas beyond the reference (ranked)

1. **Instant verdict without running the solver** — reference site makes you
   eyeball solutions; we know N up front and count real moves from hardware.
   (Core requirement, already in §5.)
2. **Auto-detection of completion + timing** — reference has no cube link at
   all; nact turns the trainer into a timed, hands-off drill loop
   (scramble → solve → verdict → next, no clicks).
3. **Wasted-move analyzer** (cross/eocross first, TS engine): after each
   solve, replay the user's moves against `distanceToSolved`; every move
   that didn't decrease the distance is flagged in the replay ("move 3 (F')
   didn't progress — distance stayed 4"). Pinpoints *which* move cost you,
   not just that you were +2. This is the single biggest training win and
   only possible because we own the tables.
4. **"Did you find an optimal solution?"** — compare the user's (reduced)
   solution against the streamed optimal set; if it matches one, say so; if
   not, show the optimal that shares the longest prefix with theirs.
5. **Progressive difficulty** — auto-bump N after X% optimal at current
   level (opt-in "ladder mode"); per-(type,N) stats already support it.
6. **Slot-agnostic mode** — generate for a random slot, detect which slot
   the user actually solved (we detect it anyway) and log it; trains
   recognition, not just execution.
7. **Retry queue** — non-optimal scrambles auto-queue for re-drill later
   (spaced repetition-lite over `TrainerAttempt.overhead > 0`).
8. **Hint on demand** — during `active`, a button reveals only the FIRST
   move of an optimal solution (from the solver, cheap at low depth).

## 8. Explicit non-goals (v1) / backlog

- ~~CMLL / EOLR trainers~~ ✅ SHIPPED (2026-07-16), completing the Roux
  family at 6 types:
  - **EOLR**: level-based (3–10, measured distribution peaks 5–9) via the
    vendored EOLRSolver(0x11) over LSE-random scrambles (aligned centers —
    an M2-offset target would put the composed pattern's centers off-home,
    which the piece-exact verification forbids). Detection mirrors the
    solver's ENCODING, not full-pattern equality (the 4c remainder stays
    scrambled!): corners + block edges + per-slot EO of the six LSE edges +
    UL/UR piece positions + center positions, matched against the 16 goal
    states (`[U/U'] M2 [AUF]` / `M' [U/U'] M2 [AUF]` from solved) modulo
    the x^k reporting offset. E2e: a 6-STM M/U solution executed as 9
    reported face turns scored "Optimal!".
  - **CMLL**: CASE-based, no level dial — a case is a random entry from the
    vendored reference alg list (vendor/roux/cmllAlgs.ts, 42 cases) wrapped
    in random pre/post AUFs and hidden in a random LSE state; the verdict's
    "book optimal" is that sequence's token count (beating it with a better
    alg reads as Optimal! too, by overhead<=0). No CMLL solver exists, so
    hints/reveal serve the reference solution (hint = next reference move
    when the user's STM prefix matches); retry stashes it in
    nativeTargetSolution. Detection: both blocks + all 8 corners
    (rouxStages piece sets), offset-tolerant. Stats pool the whole type.
- **Algorithm playback preview** — DONE: `AlgPlaybackModal` (TwistyPlayer
  with controlPanel "bottom-row" play/scrub controls, setup =
  inverse(alg), floating hint facelets, tempo 1×). Offered from four
  spots: the Academy drill's "Show me how" button, the Video icon on
  Academy cards, on Practice/Attack case cards, and on each variant row
  in CaseEdit (z-60, stacks above the edit modal).
- XCross+Free Pair combo trainer, pseudo xcross / pseudo pair variants.
- Advanced settings: move restrict, premove, center offsets.
- Streamed multi-solution viewer (vendor or18's crossSolver) — currently
  one example optimal solution per WASM-backed attempt.
- 2x2 trainer, last-layer trainer (algTrainer.html) — Training tab already
  covers algorithm drilling.
- alg.cubing.net/cubedb link-outs — nice-to-have, trivial to add later.
- PWA/offline packaging of the WASM tables.
- Replacing GPL WASM with clean-room TS for xcross/xxcross/pair — only if
  nact is ever distributed non-GPL.
