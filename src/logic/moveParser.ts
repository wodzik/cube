/**
 * Parsing and manipulation of Rubik's Cube moves.
 *
 * PURE FUNCTIONS — zero side-effects, zero React imports.
 * Easy to unit test.
 */

import type { Face, Rotation, Orientation, PhysicalMove, ParsedMove } from "../types/cube";

const FACES: Face[] = ["U", "D", "L", "R", "F", "B"];
const SLICE_MOVES = ["M", "E", "S"];
const ROTATIONS = ["x", "y", "z"];

/**
 * Parse move string to structure.
 *
 * Supported formats:
 * - "R", "R'", "R2", "R2'" (alias R2 inverse = R2)
 * - "Rw", "Rw'", "Rw2" (wide moves)
 * - "r", "r'", "r2" (lowercase wide moves)
 * - "M", "M'", "M2" (slice moves)
 * - "x", "x'", "x2" (rotations)
 *
 * @example
 * parseMove("R'") → { raw: "R'", base: "R", power: 3, isWide: false, isSlice: false, isRotation: false }
 * parseMove("Rw2") → { raw: "Rw2", base: "R", power: 2, isWide: true, isSlice: false, isRotation: false }
 */
export function parseMove(move: string): ParsedMove | null {
  const cleaned = move.replace(/[\[\]\(\)]/g, "").trim();
  if (!cleaned) return null;

  const raw = cleaned;
  const power = getMovePower(cleaned);
  const baseStr = getMoveBase(cleaned);

  // Rotation?
  if (ROTATIONS.includes(baseStr.toLowerCase())) {
    return {
      raw,
      base: baseStr.toLowerCase() as any,
      power,
      isWide: false,
      isSlice: false,
      isRotation: true,
    };
  }

  // Slice move?
  if (SLICE_MOVES.includes(baseStr.toUpperCase())) {
    return {
      raw,
      base: baseStr.toUpperCase() as "M" | "E" | "S",
      power,
      isWide: false,
      isSlice: true,
      isRotation: false,
    };
  }

  // Wide move?
  const isWide =
    baseStr.endsWith("w") ||
    baseStr.endsWith("W") ||
    (baseStr.length === 1 &&
      baseStr === baseStr.toLowerCase() &&
      "udlrfb".includes(baseStr));

  const faceStr = baseStr
    .replace(/[wW]$/, "")
    .toUpperCase() as Face;

  if (!FACES.includes(faceStr)) return null;

  return {
    raw,
    base: faceStr,
    power,
    isWide,
    isSlice: false,
    isRotation: false,
  };
}

/**
 * Get move base (without power modifiers).
 *
 * "R'" → "R"
 * "Rw2" → "Rw"
 * "R2'" → "R"
 */
export function getMoveBase(move: string): string {
  return move.replace(/[2'3]|2'|'2|1'?$/g, "").replace(/^(.+?)[2'3]*$/, "$1");
}

/**
 * Get move power (how many quarters).
 *
 * "R" → 1
 * "R2" → 2
 * "R'" → 3  (≡ R^(-1) ≡ R^3)
 * "R2'" → 2
 * "R3" → 3
 */
export function getMovePower(move: string): number {
  if (move.endsWith("2'") || move.endsWith("'2") || move.endsWith("2"))
    return 2;
  if (
    move.endsWith("'") ||
    move.endsWith("3") ||
    move.endsWith("3'")
  )
    return 3;
  return 1;
}

/**
 * Create move string from base and power (0-3).
 *
 * ("R", 0) → null
 * ("R", 1) → "R"
 * ("R", 2) → "R2"
 * ("R", 3) → "R'"
 */
export function createMoveStr(
  base: string,
  power: number
): string | null {
  power = ((power % 4) + 4) % 4;
  if (power === 0) return null;
  if (power === 1) return base;
  if (power === 2) return base + "2";
  if (power === 3) return base + "'";
  return null;
}

/**
 * Invert a move.
 *
 * "R" → "R'"
 * "R'" → "R"
 * "R2" → "R2"
 *
 * Strips "(" / ")" trigger-grouping decoration first, same as parseMove —
 * callers that split a DISPLAY alg string ("U2 (R' U R) U' (S R S')") on
 * whitespace instead of going through parseDecoratedAlg would otherwise
 * hand this a token like "(R'" or "S')": the stray paren survives
 * getMoveBase (only power suffixes are stripped there) and, worse, a
 * trailing ")" hides the power suffix from getMovePower's .endsWith
 * checks entirely — "S')" ends with ")", not "'", so it reads as power 1
 * instead of 3. createMoveStr then can't resolve the mangled base and
 * silently falls back to returning the move UNINVERTED — a setup
 * algorithm built this way applies incorrectly (or partially), which is
 * how a case can render as the solved cube instead of scrambled.
 */
export function invertMove(move: string): string {
  const cleaned = move.replace(/[()[\]]/g, "");
  const base = getMoveBase(cleaned);
  const power = getMovePower(cleaned);
  const invPower = (4 - power) % 4;
  return createMoveStr(base, invPower) ?? cleaned;
}

/**
 * Invert a sequence of moves (reverse order + each move).
 *
 * "R U F'" → "F U' R'"
 */
export function invertSequence(moves: string[]): string[] {
  return moves.slice().reverse().map(invertMove);
}

/**
 * Whether a move is a physical face move (not rotation).
 */
export function isPhysicalMove(move: string): boolean {
  const parsed = parseMove(move);
  if (!parsed) return false;
  return !parsed.isRotation;
}

// ═══════════════════════════════════════════════════════════════════════════
// VIRTUAL → PHYSICAL CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of decomposing a virtual move to physical moves.
 */
export interface DecompositionResult {
  /** Physical face moves */
  physicalMoves: Array<{ face: Face; power: number }>;
  /** Rotation to apply after physical moves */
  rotation?: { axis: Rotation; power: number };
}

/**
 * Slice move decomposition — authoritative spec:
 *
 *   M  = x' + R  + L'   fires R(1), L'(3),  rotation x'
 *   M' = x  + R' + L    fires R'(3), L(1),  rotation x
 *   E  = y' + U  + D'   fires U(1), D'(3),  rotation y'
 *   E' = y  + U' + D    fires U'(3), D(1),  rotation y
 *   S  = z  + F' + B    fires F'(3), B(1),  rotation z
 *   S' = z' + F  + B'   fires F(1), B'(3),  rotation z'
 *
 * rotDir maps to calls of applyRotation (code-x/y/z per step):
 *   x-axis: code-x×1 = physical x  → M(x') needs 3 steps → rotDir = -1 (≡ 3 mod 4)
 *   y-axis: code-y×1 = physical y' → E(y') needs 1 step  → rotDir =  1
 *   z-axis: code-z×1 = physical z  → S(z)  needs 1 step  → rotDir =  1
 */
const SLICE_CONFIG: Record<string, {
  axis: Rotation;
  rotDir: number;
  face1: Face; dir1: number;
  face2: Face; dir2: number
}> = {
  M: { axis: "x", rotDir: -1, face1: "R", dir1:  1, face2: "L", dir2: -1 },  // x' → code-x×3
  E: { axis: "y", rotDir:  1, face1: "U", dir1:  1, face2: "D", dir2: -1 },  // y' → code-y×1
  S: { axis: "z", rotDir:  1, face1: "F", dir1: -1, face2: "B", dir2:  1 },  // z  → code-z×1
};

/**
 * Wide move decomposition — authoritative spec:
 *
 *   r = x  + L   u = y  + D   f = z  + B
 *   l = x' + R   d = y' + U   b = z' + F
 *
 * rotDir maps to calls of applyRotation (code-x/y/z per step):
 *   x-axis: code-x×1 = physical x  → r(x)  needs 1 step → rotDir = 1
 *                                    l(x')  needs 3 steps → rotDir = 3
 *   y-axis: code-y×1 = physical y' → u(y)  needs 3 steps → rotDir = 3
 *                                    d(y')  needs 1 step  → rotDir = 1
 *   z-axis: code-z×1 = physical z  → f(z)  needs 1 step  → rotDir = 1
 *                                    b(z')  needs 3 steps → rotDir = 3
 */
const WIDE_CONFIG: Record<Face, {
  axis: Rotation;
  rotDir: number;
  observerFace: Face;
  middleFace: Face;
  middleDir: number;
}> = {
  R: { axis: "x", rotDir: 1, observerFace: "R", middleFace: "L", middleDir: 1 },
  L: { axis: "x", rotDir: 3, observerFace: "L", middleFace: "R", middleDir: 1 },
  U: { axis: "y", rotDir: 3, observerFace: "U", middleFace: "D", middleDir: 1 },
  D: { axis: "y", rotDir: 1, observerFace: "D", middleFace: "U", middleDir: 1 },
  F: { axis: "z", rotDir: 1, observerFace: "F", middleFace: "B", middleDir: 1 },
  B: { axis: "z", rotDir: 3, observerFace: "B", middleFace: "F", middleDir: 1 },
};

/**
 * Decompose a single move to physical face moves.
 *
 * - Normal moves (R, U', F2) → single physical move
 * - Rotations (x, y', z2) → no physical moves, just rotation
 * - Slice moves (M, E', S2) → two physical moves + rotation
 * - Wide moves (r, Rw', u2) → 1 opposite-face move + rotation around that face's axis
 *
 * @param move - Move string (e.g., "R", "M'", "r2")
 * @returns Physical moves and optional rotation
 */
export function decomposeMove(move: string): DecompositionResult {
  const parsed = parseMove(move);
  if (!parsed) {
    return { physicalMoves: [] };
  }

  const power = parsed.power;

  // Rotation — no physical moves
  if (parsed.isRotation) {
    return {
      physicalMoves: [],
      rotation: { axis: parsed.base as Rotation, power },
    };
  }

  // Slice move — decompose to two faces + rotation
  if (parsed.isSlice) {
    const cfg = SLICE_CONFIG[parsed.base as string];
    if (!cfg) return { physicalMoves: [] };

    const p1 = ((power * cfg.dir1) % 4 + 4) % 4;
    const p2 = ((power * cfg.dir2) % 4 + 4) % 4;
    const rotPower = ((power * cfg.rotDir) % 4 + 4) % 4;

    const physicalMoves: Array<{ face: Face; power: number }> = [];
    if (p1 > 0) physicalMoves.push({ face: cfg.face1, power: p1 });
    if (p2 > 0) physicalMoves.push({ face: cfg.face2, power: p2 });

    return {
      physicalMoves,
      rotation: rotPower > 0 ? { axis: cfg.axis, power: rotPower } : undefined,
    };
  }

  // Wide move = rotation + middle face move (opposite to observer face)
  if (parsed.isWide) {
    const face = parsed.base as Face;
    const cfg = WIDE_CONFIG[face];
    if (!cfg) return { physicalMoves: [] };

    const rotPower = ((power * cfg.rotDir) % 4 + 4) % 4;
    const middlePower = ((power * cfg.middleDir) % 4 + 4) % 4;

    const physicalMoves: Array<{ face: Face; power: number }> = [];
    if (middlePower > 0) {
      physicalMoves.push({ face: cfg.middleFace, power: middlePower });
    }

    return {
      physicalMoves,
      rotation: rotPower > 0 ? { axis: cfg.axis, power: rotPower } : undefined,
    };
  }

  // Normal face move
  return {
    physicalMoves: [{ face: parsed.base as Face, power }],
  };
}

/**
 * Convert an algorithm string to an array of physical moves.
 *
 * Smart cubes report ONLY single-face events — no rotations, no wide moves.
 * This function converts algorithm tokens to the physical events hardware
 * would fire.
 *
 * Orientation tracking:
 *   After each wide move, slice move, or pure rotation, we update the logical→physical
 *   face map so subsequent moves are resolved against the new hardware frame.
 *
 * Rotation semantics (physical definitions):
 *   x: F→U (front goes up)    x': F→D
 *   y: R→F (right comes front) y': L→F
 *   z: U→R (top goes right)    z': U→L
 *
 * Wide move decompositions (hardware fires the opposite-face move only; rotation = frame shift):
 *   r = x  + L    l = x' + R
 *   u = y  + D    d = y' + U
 *   f = z  + B    b = z' + F
 *
 * Slice move decompositions (hardware fires two face events; rotation = frame shift):
 *   M  = x' + R  + L'    M' = x  + R' + L
 *   E  = y' + U  + D'    E' = y  + U' + D
 *   S  = z  + F' + B     S' = z' + F  + B'
 *
 * applyRotation internals (code-axis rule applied N times per rotDir):
 *   code-x×1 = physical x   (F→U per step)
 *   code-y×1 = physical y'  (L→F per step) ← INVERTED vs physical y
 *   code-z×1 = physical z   (U→R per step)
 *   So y requires (4 − power) % 4 code-y steps to match physical y.
 *
 * @param alg - Algorithm string (e.g., "R U R' U'", "y r U r'")
 * @param initialOrientation - Starting orientation (default: identity)
 * @returns Array of physical moves with face, power, and original token index
 */
export function algToPhysicalMoves(
  alg: string,
  initialOrientation?: Orientation
): PhysicalMove[] {
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  const result: PhysicalMove[] = [];

  let orientation: Orientation = initialOrientation ?? {
    U: "U" as Face, D: "D" as Face, F: "F" as Face,
    B: "B" as Face, R: "R" as Face, L: "L" as Face,
  };

  // Applied only after wide moves — see docstring for why pure rotations are excluded.
  const applyRotation = (axis: Rotation, times: number) => {
    for (let i = 0; i < times; i++) {
      const o = { ...orientation };
      if (axis === "x") {
        // After r's x: the top goes back, front comes up → orientation.U = F.
        orientation = { ...o, U: o.F, F: o.D, D: o.B, B: o.U };
      } else if (axis === "y") {
        // y CW from above: front filled by old L.
        orientation = { ...o, F: o.L, L: o.B, B: o.R, R: o.F };
      } else {
        // z CW from front: top filled by old L.
        orientation = { ...o, U: o.L, L: o.D, D: o.R, R: o.U };
      }
    }
  };

  for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
    const token = tokens[tokenIdx];
    const parsed = parseMove(token);
    const decomp = decomposeMove(token);

    for (const pm of decomp.physicalMoves) {
      const physicalFace = orientation[pm.face];
      result.push({ face: physicalFace, power: pm.power % 4, algIndex: tokenIdx });
    }

    // Update orientation for wide moves, slice moves, and pure rotation tokens.
    // All three shift the hardware frame; wide/slice rotDir already encodes code-axis
    // steps, but pure rotation tokens need y-axis inversion (code-y×1 = physical y').
    if (decomp.rotation) {
      if (parsed?.isWide || parsed?.isSlice) {
        applyRotation(decomp.rotation.axis, decomp.rotation.power);
      } else if (parsed?.isRotation) {
        // code-y×1 = physical y', so for physical y (power=1) we need 3 code-y steps.
        // General correction for y-axis: codeSteps = (4 − power) % 4
        let codeSteps = decomp.rotation.power;
        if (decomp.rotation.axis === "y") {
          codeSteps = (4 - codeSteps) % 4;
        }
        if (codeSteps > 0) applyRotation(decomp.rotation.axis, codeSteps);
      }
    }
  }

  return result;
}

/**
 * Convert physical moves back to a string representation.
 *
 * @param moves - Array of physical moves
 * @returns Space-separated move string
 */
export function physicalMovesToString(moves: PhysicalMove[]): string {
  return moves
    .map(m => createMoveStr(m.face, m.power))
    .filter(Boolean)
    .join(" ");
}

/**
 * Reduce physical moves by combining consecutive same-face moves.
 *
 * DELIBERATELY adjacent-only: merging across intervening opposite-face
 * moves would be sound for the raw cube state, but this reduction feeds
 * sequenceTracker's block matcher, which consumes the list left-to-right
 * against target blocks — a cross-merge can pull a new (wrong) move into
 * an already-MATCHED part of the history and retroactively un-complete
 * earlier blocks. Axis-commuting collapse is applied only to the wrong-move
 * tail, where the match boundary protects the prefix — see
 * sequenceTracker's reduceWrongTailAcrossOpposites.
 *
 * @param moves - Array of physical moves
 * @returns Reduced array
 */
export function reducePhysicalMoves(moves: PhysicalMove[]): PhysicalMove[] {
  const result: PhysicalMove[] = [];

  for (const move of moves) {
    if (result.length === 0) {
      result.push({ ...move });
      continue;
    }

    const last = result[result.length - 1];
    if (last.face === move.face) {
      const newPower = (last.power + move.power) % 4;
      if (newPower === 0) {
        result.pop();
      } else {
        last.power = newPower;
      }
    } else {
      result.push({ ...move });
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE-AWARE SPLIT COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════

/** A move paired with its timestamp relative to solve start */
export interface MoveWithTime {
  move: string;
  relativeMs: number;
}

/** A stage completion boundary (relative to solve start) */
export interface StageEndPoint {
  stage: string;
  endMs: number;
}

/** Timing breakdown for a single stage (local to moveParser — decoupled from any single method's analysis engine). */
export interface StageSplit {
  stage: string;
  recognitionMs: number;
  executionMs: number;
  splitMs: number;
  completedAtMs: number;
  /** Number of raw moves in this stage */
  stepCount: number;
  /** Reduced move count (via collapseIdenticalMoves — see moveReduction.ts) */
  reducedStepCount: number;
  /** Reduced moves for this stage (stage-aware, no cross-stage merging) */
  reducedMoves: string[];
}

/**
 * Compute per-stage timing splits from timed moves and stage completion points.
 *
 * Key feature: move reduction is stage-aware — moves are NEVER merged across
 * a stage boundary. If a stage ends on move L, the first L of the next stage
 * is kept separate.
 *
 * Uses collapseIdenticalMoves (moveReduction.ts) for the reduced move count —
 * NOT simplifyMoveStack/reduceMoves, which cancel R,R' pairs to nothing. In a
 * solve, R then R' are two distinct real turns and must both be counted.
 *
 * Algorithm:
 *  For each stage (in order by endMs):
 *    1. Collect all moves with relativeMs ≤ endMs (moves consumed once, in one pass)
 *    2. recognitionMs = time from previous stage end to the FIRST move in this stage
 *    3. executionMs   = time from first move to stage end
 *  dropMs = time from last move to totalMs (solver still holding the cube after last move)
 */
export function computeStageSplits(
  moves: readonly MoveWithTime[],
  stageEnds: readonly StageEndPoint[],
  totalMs: number,
  reduceFn: (moves: string[]) => string[],
): { splits: StageSplit[]; dropMs: number } {
  const splits: StageSplit[] = [];
  let moveIdx = 0;
  let prevEndMs = 0;

  for (const { stage, endMs } of stageEnds) {
    const stageMoves: MoveWithTime[] = [];
    while (moveIdx < moves.length && moves[moveIdx].relativeMs <= endMs) {
      stageMoves.push(moves[moveIdx]);
      moveIdx++;
    }

    const firstMoveMs = stageMoves.length > 0 ? stageMoves[0].relativeMs : endMs;
    const recognitionMs = Math.max(0, firstMoveMs - prevEndMs);
    const executionMs = Math.max(0, endMs - firstMoveMs);

    // Reduce within stage only — no cross-stage merging
    const rawMoves = stageMoves.map((m) => m.move);
    const reducedMoves = reduceFn(rawMoves);

    splits.push({
      stage,
      recognitionMs,
      executionMs,
      splitMs: recognitionMs + executionMs,
      completedAtMs: endMs,
      stepCount: rawMoves.length,
      reducedStepCount: reducedMoves.length,
      reducedMoves,
    });

    prevEndMs = endMs;
  }

  const lastMoveMs = moves.length > 0 ? moves[moves.length - 1].relativeMs : totalMs;
  const dropMs = Math.max(0, totalMs - lastMoveMs);

  return { splits, dropMs };
}
