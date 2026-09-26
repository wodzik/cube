/**
 * Move sequence reduction.
 *
 * (Following a scramble / algorithm — algebraic cancellation, repairs — is
 * cubecore's SequenceTracker, see logic/cubecoreSequence.ts.)
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
 * Collapse move tokens for SOLVE display/counting (SolveRecord.reducedMoves).
 *
 * Merges ONLY maximal runs of literally-identical consecutive move tokens —
 * same face AND same direction. Does NOT perform algebraic cancellation:
 * R immediately followed by R' stays as two separate moves, because in a
 * completed solve those are two distinct physical turns, not a mistake to
 * undo.
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

/**
 * STM ("slice turn metric") view of a physical move log — for Roux trainer
 * verdicts, where the solver's optimum counts M/E/S slices as ONE move but
 * a smart cube reports a physical slice as TWO opposite face turns (the
 * core/centers rotate with the slice, so both outer faces move relative to
 * it — see rouxStages.ts's doc comment).
 *
 * First collapses identical runs (R,R → R2), then merges each ADJACENT
 * opposite-face pair whose powers are complementary (sum ≡ 0 mod 4) into
 * its slice move, using moveParser's authoritative SLICE_CONFIG mapping:
 *
 *   M^p = R^p L^(-p)   E^p = U^p D^(-p)   S^p = F^(-p) B^p
 *
 * (either token order). This can also merge a deliberately-fingered
 * "R L'" pair that wasn't physically a slice — an acceptable bias: it only
 * ever counts IN THE USER'S FAVOR, and in Roux such pairs are slices in
 * all but name. Wide moves need no handling: hardware reports a physical
 * r as a single face turn already.
 *
 * The returned tokens (faces + slices) are the STM solution; its length is
 * the STM move count.
 */
export function collapseToStm(moves: string[]): string[] {
  // Slice power = power of this face's component in the slice's decomposition.
  const SLICE_OF_FACE: Record<string, { slice: string; sign: 1 | -1 }> = {
    R: { slice: "M", sign: 1 },
    L: { slice: "M", sign: -1 },
    U: { slice: "E", sign: 1 },
    D: { slice: "E", sign: -1 },
    B: { slice: "S", sign: 1 },
    F: { slice: "S", sign: -1 },
  };

  const collapsed = collapseIdenticalMoves(moves);
  const result: string[] = [];
  let i = 0;
  while (i < collapsed.length) {
    const a = collapsed[i];
    const b = collapsed[i + 1];
    if (b !== undefined) {
      const baseA = getMoveBase(a);
      const baseB = getMoveBase(b);
      const powerA = getMovePower(a);
      const powerB = getMovePower(b);
      if (areOppositeFaces(baseA, baseB) && (powerA + powerB) % 4 === 0) {
        const spec = SLICE_OF_FACE[baseA];
        const slicePower = ((powerA * spec.sign) % 4 + 4) % 4;
        const merged = createMoveStr(spec.slice, slicePower);
        if (merged) {
          result.push(merged);
          i += 2;
          continue;
        }
      }
    }
    result.push(a);
    i += 1;
  }
  // Merged slices can now be adjacent identical (M,M from R L' R L') — collapse once more.
  return result.length < collapsed.length ? collapseIdenticalMoves(result) : result;
}
