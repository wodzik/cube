/**
 * The Blindfolded guides — how a blindfolded solve works (letters, buffer,
 * memo, parity), Old Pochmann (edges and corners), and M2 edges.
 *
 * Every algorithm and every setup comes from data/bld.ts — the same the
 * letter-pair trainer checks and the Academy "Blindfolded" drill uses (its
 * pairs are verified on the cube model in bld.test.ts). Demos are plain
 * scenes (white top, green front — the way the letters are read): the swap
 * set up as its inverse, played back to solved.
 */

import { invertSequence } from "../../logic/moveParser";
import { BLD_METHODS, type BldMethod, M2_EDGES, OP_CORNERS, OP_EDGES, methodLetters, solveLetter, stickerName } from "../bld";
import { algTokens } from "./helpers";
import type { Guide, GuideBlock, GuideCase, GuideDemo } from "./types";

/** The swap as its own case: set up by its inverse, played back to solved. */
function swapCase(id: string, name: string, recognise: string, alg: string, note?: string): GuideCase {
  return { id, name, recognise, alg, demo: swapDemo(alg), ...(note ? { note } : {}) };
}
const swapDemo = (alg: string): GuideDemo => ({ setup: invertSequence(algTokens(alg)).join(" "), alg: algTokens(alg).join(" ") });
const looping = (alg: string): GuideDemo => ({ ...swapDemo(alg), loop: true, repeat: 1 });

/** Every letter of a method: where it is, and its setup (or its own algorithm). */
function setupTable(method: BldMethod): GuideBlock {
  const rows = methodLetters(method).map((l) => {
    if (method.bufferLetters.includes(l)) return [l, stickerName(method, l), "buffer — never a target", ""];
    const s = solveLetter(method, l);
    const second = method.secondOfPair?.[l];
    const how = s.setup ? `\`${s.setup}\` · ${s.name} · \`${s.undo}\`` : s.alg === method.swap.alg ? `${s.name} (no setup)` : `\`${s.alg}\``;
    return [l, stickerName(method, l), how, second ? `second letter of a pair: as ${second}` : ""];
  });
  return { kind: "table", columns: ["Letter", "Sticker", "Setup · swap · undo", ""], rows };
}

const T = OP_EDGES.swap.alg;
const Y = OP_CORNERS.swap.alg;

export const BLD_BASICS_GUIDE: Guide = {
  id: "bld-basics",
  title: "Blindfolded: how it works",
  tagline: "Letters on the stickers, one buffer, and a list to remember — the idea behind every blindfolded method.",
  category: "blind",
  readingTime: "~15 min",
  intro: [
    "A blindfolded solve has two halves: you look at the scrambled cube and **memorise** it, then you put the blindfold on and **execute** from memory. No peeking in between.",
    "The trick is to never solve \"the cube\" — you solve one piece at a time, always from the same spot (the buffer), with the same one algorithm. What you remember is just a list of letters.",
  ],
  hero: looping(T),
  preview: looping(T),
  sections: [
    {
      id: "letters",
      title: "A letter for every sticker",
      eyebrow: "Letters",
      blocks: [
        { kind: "p", text: "Each face gets four letters, clockwise from its top-left corner (and from its top edge for the edges): **U** A–D, **L** E–H, **F** I–L, **R** M–P, **B** Q–T, **D** U–X. That's the **Speffz** scheme, the most common one. Corners and edges use the same letters — which one you mean is clear from which piece you're memorising." },
        {
          kind: "table",
          columns: ["Face", "Letters", "Looking at it with"],
          rows: [
            ["U (white)", "A B C D", "B at the top"],
            ["L (orange)", "E F G H", "U at the top"],
            ["F (green)", "I J K L", "U at the top"],
            ["R (red)", "M N O P", "U at the top"],
            ["B (blue)", "Q R S T", "U at the top"],
            ["D (yellow)", "U V W X", "F at the top"],
          ],
        },
        { kind: "callout", tone: "tip", title: "Learn them on a cube", text: ["Practice → Blindfolded shows the letters on the stickers (Cube: Letters). Hold white on top, green in front — the letters are always read that way."] },
      ],
    },
    {
      id: "buffer",
      title: "The buffer",
      eyebrow: "Idea",
      blocks: [
        { kind: "p", text: "One spot for the edges and one for the corners is the **buffer**. Look at the sticker in the buffer: it belongs somewhere — say on sticker **Q**. Remember Q. Swapping the buffer with Q puts that piece home, and brings Q's piece into the buffer. Now that one belongs somewhere else: remember its letter, and so on." },
        { kind: "p", text: "Each letter is one swap — always the same algorithm, with a few **setup** moves that bring the target to the swap's spot first and are undone right after. The setups are what you learn per letter; the swap never changes." },
        { kind: "callout", tone: "note", text: ["Old Pochmann: edges from UR (letter B), corners from ULB (letter A). M2: edges from DF (letter U). The Old Pochmann and M2 guides have every letter's setup."] },
      ],
    },
    {
      id: "memo",
      title: "Memorising",
      eyebrow: "Memo",
      blocks: [
        {
          kind: "list",
          ordered: true,
          items: [
            "Look at the buffer's sticker, find where it belongs: that's your first letter.",
            "Look at the piece now sitting on that letter's spot (where it belongs): the next letter.",
            "Keep going until you reach the buffer's own piece — its letters are never memorised.",
            "Pieces still out of place? **Cycle break**: pick any of them, remember one of its letters, follow it until you come back to it (remember that letter again).",
            "A piece in its place but flipped (edge) or twisted (corner) is a tiny cycle: two letters of the same piece.",
          ],
        },
        { kind: "p", text: "Memorise edges and corners separately. Group the letters in **pairs** — \"QU SR NX IV\" — and turn each pair into a word or an image: two letters are much easier to hold than one." },
        { kind: "callout", tone: "tip", text: ["The full-solve trainer does the memo for you and follows every letter on a smart cube: Practice → Blindfolded."] },
      ],
    },
    {
      id: "parity",
      title: "Parity",
      eyebrow: "Memo",
      blocks: [
        { kind: "p", text: "Every edge swap also swaps two corners on the side (and every corner swap two edges). With an even number of edge letters those extras cancel out. With an **odd** number they don't: after the edges, do the **parity** algorithm, then the corners as usual." },
        { kind: "callout", tone: "note", text: ["Old Pochmann: the Ra-perm. M2: its own parity algorithm — see the M2 guide."] },
      ],
    },
    {
      id: "next",
      title: "Where next",
      blocks: [
        { kind: "guideLink", guideId: "bld-op", label: "Old Pochmann", text: "The simplest method: every letter is a setup, a T-perm or Y-perm, and the setup undone." },
        { kind: "guideLink", guideId: "bld-m2", label: "M2 edges", text: "Faster edges once Old Pochmann is comfortable." },
        { kind: "bldTrainer", method: "op-edges", label: "Letter pairs trainer", text: "Two letters, shoot to both — the execution drill, checked on a smart cube." },
      ],
    },
  ],
};

export const BLD_OP_GUIDE: Guide = {
  id: "bld-op",
  title: "Old Pochmann",
  tagline: "Edges with the T-perm, corners with a modified Y-perm — every letter a setup, one swap and the setup undone.",
  category: "blind",
  readingTime: "~30 min",
  prerequisites: ["bld-basics"],
  intro: [
    "Old Pochmann solves one piece per letter with a permutation you may know from PLL: the T-perm for edges, a modified Y-perm for corners. Slow compared to advanced methods, but nothing else to learn — the best way into blindfolded.",
    "Hold the cube white on top, green in front for the whole solve.",
  ],
  hero: looping(Y),
  preview: looping(T),
  sections: [
    {
      id: "edges",
      title: "Edges",
      eyebrow: "Buffer UR (B)",
      blocks: [
        { kind: "p", text: "The buffer is **UR** (letter B; its other sticker is M). The T-perm swaps UR with **UL** (letter D) — and two corners on the side, which a second letter puts back. For each letter: the setup brings its sticker to UL, the T-perm, the setup undone." },
        {
          kind: "cases",
          cases: [
            swapCase("op-t", "T-perm", "Swaps UR ↔ UL: letter D, and every set-up letter.", "(R U R' U') R' F R2 (U' R' U') R U R' F'"),
            swapCase("op-ja", "Ja-perm", "Letter A (UB) — no setup.", "R2 D R D' R F2 r' F r F2", "The rotation-free spelling of `x R2 F R F' R U2 r' U r U2 x'`."),
            swapCase("op-jb", "Jb-perm", "Letter C (UF) — no setup.", "R U R' F' (R U R' U') R' F R2 U' R' U'"),
          ],
        },
        { kind: "callout", tone: "warning", text: ["A setup never moves the buffer (UR) or the two corners the T-perm swaps (UFR, UBR) — that's why there are no U or R moves in the table."] },
        setupTable(OP_EDGES),
      ],
    },
    {
      id: "corners",
      title: "Corners",
      eyebrow: "Buffer ULB (A)",
      blocks: [
        { kind: "p", text: "The buffer is **ULB** (letters A, E, R). The modified Y-perm swaps it with **RDF** (letter P). Setups use only R, D and F — they never touch the U layer's buffer or the edges the Y-perm swaps." },
        { kind: "cases", cases: [swapCase("op-y", "Modified Y-perm", "Swaps ULB ↔ RDF: letter P, and every set-up letter.", "(R U' R' U') R U R' F' (R U R' U') R' F R")] },
        setupTable(OP_CORNERS),
      ],
    },
    {
      id: "parity",
      title: "Parity",
      eyebrow: "Odd edge letters",
      blocks: [
        { kind: "p", text: "An odd number of edge letters leaves the T-perm's two corners swapped (and UL / UB swapped). The **Ra-perm** fixes both — do it after the edges, before the corners." },
        { kind: "cases", cases: [swapCase("op-parity", "Parity (Ra-perm)", "After the edges, when there was an odd number of edge letters.", "R U' R' U' R U R D R' U' R D' R' U2 R' U'")] },
      ],
    },
    {
      id: "practice",
      title: "Practise",
      blocks: [
        { kind: "practice", lessonId: "blindfolded", stepId: "op-edges", label: "Drill the swaps in the Academy" },
        { kind: "bldTrainer", method: "op-edges", label: "Letter pairs: edges", text: "Two letters at a time — setup, T-perm, undo — checked on a smart cube." },
        { kind: "bldTrainer", method: "op-corners", label: "Letter pairs: corners", text: "The same with the Y-perm." },
      ],
    },
  ],
};

export const BLD_M2_GUIDE: Guide = {
  id: "bld-m2",
  title: "M2 edges",
  tagline: "Edges with just M2 — short setups, a few special letters on the M slice.",
  category: "blind",
  readingTime: "~25 min",
  prerequisites: ["bld-op"],
  intro: [
    "M2 swaps the buffer **DF** (letter U) with **UB** (letter A). Each letter: a setup bringing its sticker to UB without touching the M slice, M2, the setup undone — far shorter than a T-perm.",
    "M2 also turns the M slice's other pieces over, so letters come in **pairs**: after the first letter of a pair, UF and DB (and FU / BD) have swapped places — the second letter of a pair shoots to the other one.",
  ],
  hero: looping(M2_EDGES.direct.C.alg),
  preview: looping(M2_EDGES.direct.C.alg),
  sections: [
    {
      id: "swap",
      title: "The swap",
      eyebrow: "Buffer DF (U)",
      blocks: [
        { kind: "p", text: "M2 — the M slice a half turn — puts the buffer's piece on UB. A setup brings the target there first; it may not move the M slice (UF, DF, DB, the centres), which is why the setups are conjugates like `U R U'`." },
        setupTable(M2_EDGES),
      ],
    },
    {
      id: "special",
      title: "The M-slice letters",
      eyebrow: "Special",
      blocks: [
        { kind: "p", text: "**C** (UF) and **W** (DB), **I** (FU) and **S** (BD) sit in the slice M2 turns — they have their own algorithms. As the **second** letter of a pair they swap round: C is shot as W, W as C, I as S, S as I (the first M2 moved them). **Q** (BU) is UB flipped." },
        {
          kind: "cases",
          cases: [
            swapCase("m2-c", "C (UF)", "First letter of a pair — as a second letter, use W's.", M2_EDGES.direct.C.alg),
            swapCase("m2-w", "W (DB)", "First letter of a pair — as a second letter, use C's.", M2_EDGES.direct.W.alg),
            swapCase("m2-i", "I (FU)", "First letter of a pair — as a second letter, use S's.", M2_EDGES.direct.I.alg),
            swapCase("m2-s", "S (BD)", "First letter of a pair — as a second letter, use I's.", M2_EDGES.direct.S.alg),
            swapCase("m2-q", "Q (BU)", "Either letter of a pair.", M2_EDGES.direct.Q.alg),
          ],
        },
      ],
    },
    {
      id: "parity",
      title: "Parity",
      eyebrow: "Odd edge letters",
      blocks: [
        { kind: "p", text: "With an odd number of edge letters the last M2 leaves the slice turned. The parity algorithm puts it back (it swaps UB and UL — solve the corners with those two swapped)." },
        { kind: "cases", cases: [swapCase("m2-parity", "Parity", "After the edges, when there was an odd number of edge letters.", BLD_METHODS.m2.parity.alg)] },
      ],
    },
    {
      id: "practice",
      title: "Practise",
      blocks: [
        { kind: "practice", lessonId: "blindfolded", stepId: "m2", label: "Drill the special letters in the Academy" },
        { kind: "bldTrainer", method: "m2", label: "Letter pairs: M2", text: "Pairs of letters, the second-letter rule included — checked on a smart cube." },
      ],
    },
  ],
};
