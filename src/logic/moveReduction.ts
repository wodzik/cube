/**
 * Move sequence reduction.
 *
 * Three different reducers for three different purposes — do not swap them:
 *
 *  - `simplifyMoveStack` / `reduceMoves`: ALGEBRAIC cancellation (R + R' = []).
 *    Correct for sequenceTracker.ts (scramble/algorithm progress, wrong-move
 *    repair) — there we care about the *net* motion matching a target.
 *
 *  - `collapseIdenticalMoves`: display/counting only, for a completed solve.
 *    Merges ONLY literally-repeated identical tokens (R,R → R2). Does NOT
 *    cancel R,R' — those are two distinct physical turns in a real solve,
 *    not a mistake to undo, and must both be counted.
 *
 * PURE FUNCTIONS — zero side-effects, zero React imports.
 */

import { getMoveBase, getMovePower, createMoveStr, parseMove } from "./moveParser";

const OPPOSITE_FACES: Record<string, string> = {
  R: "L",
  L: "R",
  U: "D",
  D: "U",
  F: "B",
  B: "F",
};

/**
 * Check if two faces are opposite each other.
 * R↔L, U↔D, F↔B
 */
export function areOppositeFaces(face1: string, face2: string): boolean {
  return OPPOSITE_FACES[face1] === face2;
}

/**
 * Simplify move stack by combining consecutive moves on the same face.
 *
 * PURPOSE: scramble/algorithm tracking (sequenceTracker.ts) — matching
 * incoming moves against a target sequence, and error/repair stacks. This is
 * a "full" simplification that cancels out opposite moves (R + R' = nothing).
 *
 * Does NOT reorder moves - order is preserved for error stacks.
 *
 * RULES:
 * 1. If consecutive moves have same base → combine powers (mod 4)
 * 2. If combination result = 0 → cancel out (R + R' = [])
 * 3. Order is preserved (R, L, R stays as is, not R2, L)
 *
 * @example
 * simplifyMoveStack(["R", "R'"]) → []
 * simplifyMoveStack(["R", "R"]) → ["R2"]
 * simplifyMoveStack(["R", "U", "U'"]) → ["R"]
 * simplifyMoveStack(["R", "L", "R"]) → ["R", "L", "R"] (not reordered)
 */
export function simplifyMoveStack(moves: string[]): string[] {
  const stack: string[] = [];

  for (const move of moves) {
    if (stack.length === 0) {
      stack.push(move);
      continue;
    }

    const last = stack[stack.length - 1];
    const lastBase = getMoveBase(last);
    const moveBase = getMoveBase(move);

    if (lastBase === moveBase) {
      const combinedPower = (getMovePower(last) + getMovePower(move)) % 4;
      stack.pop();

      if (combinedPower !== 0) {
        const merged = createMoveStr(lastBase, combinedPower);
        if (merged) stack.push(merged);
      }
    } else {
      stack.push(move);
    }
  }

  return stack;
}

/**
 * Reduce a sequence of moves by combining consecutive moves on the same face,
 * additionally reordering across a single intervening move on the OPPOSITE
 * face (opposite faces commute, so this is a valid simplification).
 *
 * RULES:
 * 1. Same face consecutive moves → combine powers (mod 4)
 * 2. If move on opposite face separates two moves on same face → reorder and combine
 *    Example: "R L R" → "R2 L" (R and L are opposite, so order can be swapped)
 * 3. Power = 0 → remove from sequence
 *
 * @example
 * reduceMoves(["R", "R'"]) → []
 * reduceMoves(["R", "R"]) → ["R2"]
 * reduceMoves(["R", "L", "R"]) → ["R2", "L"]
 * reduceMoves(["R", "U", "R"]) → ["R", "U", "R"] (U is not opposite to R)
 */
export function reduceMoves(moves: string[]): string[] {
  const result: string[] = [];

  for (const move of moves) {
    const parsed = parseMove(move);
    if (parsed === null) continue;

    let currentMove: ReturnType<typeof parseMove> = parsed;

    while (result.length > 0 && currentMove !== null) {
      const lastParsed = parseMove(result[result.length - 1]);
      if (lastParsed === null) {
        result.pop();
        continue;
      }

      if (lastParsed.base === currentMove.base) {
        result.pop();
        const combinedPower = (lastParsed.power + currentMove.power) % 4;
        if (combinedPower === 0) {
          currentMove = null;
          break;
        }
        const newMove = createMoveStr(currentMove.base, combinedPower);
        currentMove = newMove ? parseMove(newMove) : null;
        continue;
      }

      if (areOppositeFaces(lastParsed.base, currentMove.base) && result.length >= 2) {
        const prevParsed = parseMove(result[result.length - 2]);
        if (prevParsed !== null && prevParsed.base === currentMove.base) {
          result.pop();
          result.pop();

          const combinedPower = (prevParsed.power + currentMove.power) % 4;

          const oppositeMove = createMoveStr(lastParsed.base, lastParsed.power);
          if (oppositeMove) result.push(oppositeMove);

          if (combinedPower === 0) {
            currentMove = null;
            break;
          }
          const newMove = createMoveStr(currentMove.base, combinedPower);
          currentMove = newMove ? parseMove(newMove) : null;
          continue;
        }
      }

      break;
    }

    if (currentMove !== null) {
      const moveStr = createMoveStr(currentMove.base, currentMove.power);
      if (moveStr) result.push(moveStr);
    }
  }

  return result;
}

/**
 * Collapse move tokens for SOLVE display/counting (SolveRecord.reducedMoves).
 *
 * Merges ONLY maximal runs of literally-identical consecutive move tokens —
 * same face AND same direction. Does NOT perform algebraic cancellation:
 * R immediately followed by R' stays as two separate moves, because in a
 * completed solve those are two distinct physical turns, not a mistake to
 * undo. This is the key difference from simplifyMoveStack/reduceMoves.
 *
 * @example
 * collapseIdenticalMoves(["R", "R"]) → ["R2"]
 * collapseIdenticalMoves(["R", "R'"]) → ["R", "R'"]        (NOT merged)
 * collapseIdenticalMoves(["R", "R", "R"]) → ["R'"]
 * collapseIdenticalMoves(["R", "R", "R", "R"]) → []         (full turn, net zero)
 * collapseIdenticalMoves(["R", "U", "R"]) → ["R", "U", "R"] (not adjacent)
 */
export function collapseIdenticalMoves(moves: string[]): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < moves.length) {
    const token = moves[i];
    let runLength = 1;
    while (i + runLength < moves.length && moves[i + runLength] === token) {
      runLength++;
    }

    const base = getMoveBase(token);
    const power = getMovePower(token);
    const combinedPower = (power * runLength) % 4;
    const merged = createMoveStr(base, combinedPower);
    if (merged) result.push(merged);

    i += runLength;
  }

  return result;
}
