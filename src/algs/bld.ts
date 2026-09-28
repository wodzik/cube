/**
 * The Blind algorithm sets (Practice → Algorithms → Blind), generated from
 * data/bld.ts — the same swaps and setups as the guides and the trainers:
 *
 *  - "Blind swaps": the swap algorithms themselves (T, Ja, Jb, modified Y,
 *    the parities, M2 and its special letters);
 *  - "OP edges" / "OP corners" / "M2 edges": one case per letter, its
 *    algorithm the whole letter — (setup) swap (undo).
 *
 * Built-in like the bundled JSON sets (stable ids, your own variants on top,
 * hide what you don't use).
 */

import type { RawCase } from "../services/algorithmStore";
import { BLD_METHODS, type BldMethod, JA_PERM, JB_PERM, M2_EDGES, M2_PARITY, MODIFIED_Y, RA_PARITY, T_PERM, solveLetter, stickerName, targetLetters } from "../data/bld";

const one = (name: string, category: string, alg: string): RawCase => ({ name, category, algList: [{ name: "Default", alg, isDefault: true }] });

export const BLD_SWAPS: RawCase[] = [
  one("T-perm", "OP edges", T_PERM),
  one("Ja-perm", "OP edges", JA_PERM),
  one("Jb-perm", "OP edges", JB_PERM),
  one("OP parity (Ra-perm)", "OP edges", RA_PARITY),
  one("Modified Y-perm", "OP corners", MODIFIED_Y),
  one("M2", "M2 edges", "M2"),
  one("M2: UF (C)", "M2 edges", M2_EDGES.direct.C.alg),
  one("M2: DB (W)", "M2 edges", M2_EDGES.direct.W.alg),
  one("M2: FU (I)", "M2 edges", M2_EDGES.direct.I.alg),
  one("M2: BD (S)", "M2 edges", M2_EDGES.direct.S.alg),
  one("M2: BU (Q)", "M2 edges", M2_EDGES.direct.Q.alg),
  one("M2 parity", "M2 edges", M2_PARITY),
];

/** One case per letter: "(setup) swap (undo)" — the parentheses are display-only. */
function letterCases(method: BldMethod): RawCase[] {
  return targetLetters(method).map((l) => {
    const s = solveLetter(method, l);
    const alg = s.setup ? `(${s.setup}) ${s.alg} (${s.undo})` : s.alg;
    return one(`${l} · ${stickerName(method, l)}`, s.setup ? "Setup" : s.alg === method.swap.alg ? "No setup" : "Own algorithm", alg);
  });
}

export const BLD_OP_EDGES = letterCases(BLD_METHODS["op-edges"]);
export const BLD_OP_CORNERS = letterCases(BLD_METHODS["op-corners"]);
export const BLD_M2 = letterCases(BLD_METHODS.m2);
