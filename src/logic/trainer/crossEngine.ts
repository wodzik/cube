/**
 * Cross trainer engine — pure TypeScript, no WASM (plan-trainer.md §3).
 *
 * Tracks ONLY the 4 cross edges of one face: each edge is one of 24
 * piece-states (12 positions × 2 orientations), so a full cross state is a
 * base-24 number with 4 digits — 24⁴ = 331,776 slots, of which the 190,080
 * with distinct positions are legal/reachable. Small enough that a full BFS
 * from solved (building an EXACT distance table plus a list of every state
 * grouped by its optimal depth) runs in well under a second at init.
 *
 * That exact-distance table is what makes the trainer's headline features
 * cheap, mirroring how or18's RubiksSolverDemo trainers work (see
 * plan-trainer.md §1.1) but without their WASM/GPL surface:
 *  - "scramble whose optimal cross is exactly N": uniformly sample a state
 *    from statesByDepth[N] — optimal-by-construction, no rejection loop.
 *  - "all optimal solutions": DFS that only ever follows moves decreasing
 *    the exact distance by 1 — enumerates precisely the optimal solutions.
 *  - "which of your moves was wasted": distance lookup before/after each
 *    move of the user's actual solution.
 *
 * The per-piece 24×18 move table is DERIVED from cubing/kpuzzle at init by
 * applying each move to the solved pattern — never hand-transcribed — for
 * the same reason liveCubeState.ts is built on kpuzzle: transcription errors
 * in permutation tables are silent and lethal. Piece/slot indexing therefore
 * matches liveCubeState.ts exactly (EDGES: 0=UF 1=UR 2=UB 3=UL 4=DF 5=DR
 * 6=DB 7=DL 8=FR 9=FL 10=BR 11=BL).
 *
 * PURE LOGIC + one async init (kpuzzle load). No React, no DOM, no storage.
 */

import { cube3x3x3 } from "cubing/puzzles";
import { FACE_SLOTS, type Face } from "../stageDetection/lastLayerShared";

/** Canonical move order — index in this list is the move id used everywhere below. */
export const MOVE_NAMES = [
  "U", "U2", "U'",
  "D", "D2", "D'",
  "L", "L2", "L'",
  "R", "R2", "R'",
  "F", "F2", "F'",
  "B", "B2", "B'",
] as const;

const MOVE_INDEX = new Map<string, number>(MOVE_NAMES.map((name, i) => [name, i]));

/** Max optimal cross length — every cross state is solvable in ≤ 8 moves. */
export const MAX_CROSS_DEPTH = 8;

const PIECE_STATES = 24; // 12 positions × 2 orientations
const STATE_SPACE = PIECE_STATES ** 4; // 331,776 (190,080 legal)

export interface CrossMoveAnalysis {
  move: string;
  distBefore: number;
  distAfter: number;
  /** True when this move did not bring the cross closer to solved. */
  wasted: boolean;
}

export class CrossEngine {
  /** [moveId * 24 + pieceState] -> new pieceState. Face-independent (per-piece motion). */
  private readonly moveTable: Uint8Array;
  /** Exact optimal distance per encoded cross state; 255 = unreachable/illegal. */
  private readonly depth: Uint8Array;
  /** Every legal state at exactly depth d (index d-1; depth 0 is just the solved state). */
  private readonly statesByDepth: Uint32Array[];
  private readonly solvedIdx: number;
  /** The 4 edge piece ids this engine tracks (== their solved slots), in FACE_SLOTS order. */
  private readonly trackedPieces: readonly number[];

  readonly face: Face;

  constructor(face: Face, moveTable: Uint8Array) {
    this.face = face;
    this.moveTable = moveTable;

    // Track the 4 cross edges of `face`, in FACE_SLOTS order. In the solved
    // pattern each piece sits in its own slot, orientation 0.
    this.trackedPieces = FACE_SLOTS[face].edgeSlots;
    this.solvedIdx = encode(this.trackedPieces.map((p) => p * 2));

    // Full BFS from solved — exact distances + depth-indexed state lists.
    const depth = new Uint8Array(STATE_SPACE).fill(255);
    depth[this.solvedIdx] = 0;
    const byDepth: number[][] = [];
    let frontier: number[] = [this.solvedIdx];
    for (let d = 1; frontier.length > 0; d++) {
      const next: number[] = [];
      for (const idx of frontier) {
        for (let m = 0; m < 18; m++) {
          const to = this.applyMove(idx, m);
          if (depth[to] === 255) {
            depth[to] = d;
            next.push(to);
          }
        }
      }
      if (next.length > 0) byDepth.push(next);
      frontier = next;
    }
    this.depth = depth;
    this.statesByDepth = byDepth.map((list) => Uint32Array.from(list));
  }

  /** Apply one move (by id) to an encoded state. */
  private applyMove(idx: number, moveId: number): number {
    const base = moveId * PIECE_STATES;
    const t = this.moveTable;
    const s0 = t[base + (idx % 24)];
    const s1 = t[base + (((idx / 24) | 0) % 24)];
    const s2 = t[base + (((idx / 576) | 0) % 24)];
    const s3 = t[base + (((idx / 13824) | 0) % 24)];
    return s0 + 24 * (s1 + 24 * (s2 + 24 * s3));
  }

  /** Encoded cross state after applying `moves` to `from` (default: solved). Throws on non-face-turn tokens. */
  stateAfter(moves: readonly string[], from: number = this.solvedIdx): number {
    let idx = from;
    for (const move of moves) {
      const m = MOVE_INDEX.get(move);
      if (m === undefined) throw new Error(`CrossEngine: not a face turn: "${move}"`);
      idx = this.applyMove(idx, m);
    }
    return idx;
  }

  /**
   * Encoded cross state read off a live cube pattern's EDGES orbit
   * (LiveCubeState/KPattern patternData.EDGES — same indexing, see module
   * doc comment). This is the bridge from "wherever the physical cube
   * actually is" into the engine's state space.
   */
  stateFromEdgesOrbit(edges: { pieces: number[]; orientation: number[] }): number {
    return encode(
      this.trackedPieces.map((piece) => {
        const slot = edges.pieces.indexOf(piece);
        return slot * 2 + edges.orientation[slot];
      })
    );
  }

  /** Exact optimal solution length for the state. */
  distance(idx: number): number {
    const d = this.depth[idx];
    if (d === 255) throw new Error("CrossEngine: unreachable state");
    return d;
  }

  isSolved(idx: number): boolean {
    return idx === this.solvedIdx;
  }

  /** How many distinct legal states sit at exactly this optimal depth. */
  stateCountAtDepth(depthN: number): number {
    return depthN === 0 ? 1 : (this.statesByDepth[depthN - 1]?.length ?? 0);
  }

  /** Uniformly random state whose optimal solution is EXACTLY depthN moves. */
  sampleStateAtDepth(depthN: number, random: () => number = Math.random): number {
    if (depthN < 1 || depthN > this.statesByDepth.length) {
      throw new Error(`CrossEngine: no states at depth ${depthN} (max ${this.statesByDepth.length})`);
    }
    const list = this.statesByDepth[depthN - 1];
    return list[Math.floor(random() * list.length)];
  }

  /**
   * All optimal solutions for the state (up to `limit`), each exactly
   * distance(idx) moves. The DFS only follows moves that decrease the exact
   * distance by 1, so nothing non-optimal can be produced. Commuting
   * same-axis pairs are canonicalized (U D allowed, D U skipped — same rule
   * as or18's ma table) so the list has no trivially-reordered duplicates.
   */
  optimalSolutions(idx: number, limit = 50): string[] {
    const solutions: string[] = [];
    const path: number[] = [];
    const walk = (cur: number, prevMove: number): boolean => {
      const d = this.depth[cur];
      if (d === 0) {
        solutions.push(path.map((m) => MOVE_NAMES[m]).join(" "));
        return solutions.length >= limit;
      }
      const prevFace = prevMove < 0 ? -1 : (prevMove / 3) | 0;
      for (let m = 0; m < 18; m++) {
        const face = (m / 3) | 0;
        if (face === prevFace) continue;
        // Same axis (U/D, L/R, F/B are pairs 0/1, 2/3, 4/5): only the
        // lower-face-first order is enumerated.
        if (prevFace >= 0 && (face >> 1) === (prevFace >> 1) && prevFace > face) continue;
        const to = this.applyMove(cur, m);
        if (this.depth[to] !== d - 1) continue;
        path.push(m);
        const stop = walk(to, m);
        path.pop();
        if (stop) return true;
      }
      return false;
    };
    walk(idx, -1);
    return solutions;
  }

  /** First optimal solution only — for scramble composition, any optimal one will do. */
  firstOptimalSolution(idx: number): string {
    return this.optimalSolutions(idx, 1)[0] ?? "";
  }

  /**
   * Per-move verdict over an actual solve, starting from the encoded state
   * the attempt began at: which moves reduced the exact cross distance and
   * which were wasted. Feed COLLAPSED moves (collapseIdenticalMoves) so a
   * physical R,R pair is judged once as R2. Analysis stops at the move that
   * reaches distance 0.
   */
  analyzeSolve(startIdx: number, solveMoves: readonly string[]): CrossMoveAnalysis[] {
    let idx = startIdx;
    const analysis: CrossMoveAnalysis[] = [];
    for (const move of solveMoves) {
      const m = MOVE_INDEX.get(move);
      if (m === undefined) throw new Error(`CrossEngine: not a face turn: "${move}"`);
      const distBefore = this.depth[idx];
      idx = this.applyMove(idx, m);
      const distAfter = this.depth[idx];
      analysis.push({ move, distBefore, distAfter, wasted: distAfter >= distBefore });
      if (distAfter === 0) break;
    }
    return analysis;
  }
}

// ─── Init ───

let moveTablePromise: Promise<Uint8Array> | null = null;

/**
 * Derive the per-piece edge move table from kpuzzle: apply each move to the
 * solved pattern; the piece that started at position p (piece id == start
 * position on a solved cube) is found at its new slot with the orientation
 * delta the move gave it.
 */
async function loadMoveTable(): Promise<Uint8Array> {
  if (!moveTablePromise) {
    moveTablePromise = (async () => {
      const kpuzzle = await cube3x3x3.kpuzzle();
      const solved = kpuzzle.defaultPattern();
      const table = new Uint8Array(18 * PIECE_STATES);
      for (let m = 0; m < 18; m++) {
        const edges = solved.applyMove(MOVE_NAMES[m]).patternData.EDGES;
        for (let slot = 0; slot < 12; slot++) {
          const fromPos = edges.pieces[slot];
          const oriDelta = edges.orientation[slot];
          for (let ori = 0; ori < 2; ori++) {
            table[m * PIECE_STATES + (fromPos * 2 + ori)] = slot * 2 + ((ori + oriDelta) % 2);
          }
        }
      }
      return table;
    })();
  }
  return moveTablePromise;
}

const engineCache = new Map<Face, Promise<CrossEngine>>();

/** Engine for the cross of `face` — built once per face, cached. */
export function getCrossEngine(face: Face = "U"): Promise<CrossEngine> {
  let cached = engineCache.get(face);
  if (!cached) {
    cached = loadMoveTable().then((table) => new CrossEngine(face, table));
    engineCache.set(face, cached);
  }
  return cached;
}

function encode(pieceStates: number[]): number {
  return pieceStates[0] + 24 * (pieceStates[1] + 24 * (pieceStates[2] + 24 * pieceStates[3]));
}
