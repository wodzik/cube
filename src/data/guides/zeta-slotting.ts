/**
 * "Zeta Slotting" — an alternative order for the first two layers: every
 * edge goes in BEFORE any corner. Once all four edges are seated, each
 * corner drops in around its (already-placed, already-correct) edge with
 * one of three short algorithms — these are exactly F2L's "Edge In Slot"
 * cases (F2L 32-34 in the Drill Algorithms F2L set), verified against the
 * engine in academy.test.ts and guides.test.ts.
 *
 * Zeta Slotting is a genuinely DIFFERENT method from "Two first layers"
 * (Layer by layer's corner-first order), and has its own Academy lesson
 * (ZETA_SLOTTING, data/academy.ts) rather than sharing steps with it. With
 * no corner to protect, its edge inserts are much shorter than the
 * second-layer step's (R U' R', or the hedgeslammer for an unoriented
 * edge) — and they disturb a first-layer corner in passing, which is why
 * the demos hide every corner.
 *
 * All algorithms come from ZETA_SLOTTING via helpers.academyAlg, so guide
 * and drill can't drift apart.
 */

import type { Guide } from "./types";
import { academyAlg, solveCase, SOLVED_SETUP } from "./helpers";
import { ZETA_SLOTTING } from "../academy";

const EDGE = (algId: string) => academyAlg("zeta-edges", algId, ZETA_SLOTTING);
const CORNER = (algId: string) => academyAlg("zeta-corners", algId, ZETA_SLOTTING);

export const ZETA_SLOTTING_GUIDE: Guide = {
  id: "zeta-slotting",
  title: "Zeta Slotting",
  tagline: "Insert every edge before touching a single corner — then a small set of F2L algorithms drops each corner in around the edge that's already there.",
  category: "learn",
  readingTime: "~25 min",
  prerequisites: ["layer-by-layer"],
  intro: [
    "\"Layer by layer\" solves the first two layers corner-first: all four white corners, then all four middle edges. Zeta Slotting flips that order — **every edge first, then every corner** — using the exact same cross and the exact same edge-insertion moves you already know.",
    "Why bother? Once an edge is sitting correctly in its slot, there are only three ways a corner can need inserting above it (not the four-ish of the corner-first order), and those three algorithms are exactly the \"Edge In Slot\" cases from full F2L — so this method doubles as your first real F2L practice, just applied to every slot instead of only when you happen to get lucky.",
  ],
  hero: { alg: "U R U' R' U R U' R' U R U' R'", loop: true, repeat: 2, label: "Reverse sexy ×3 — corner around a seated edge" },
  sections: [
    {
      id: "cross",
      title: "Start from the cross",
      eyebrow: "Before you start",
      blocks: [
        { kind: "p", text: "Build the white cross exactly as in Layer by layer — nothing changes there." },
        { kind: "guideLink", guideId: "layer-by-layer", label: "Layer by layer · Step 1", text: "The white cross, if you need a refresher." },
        { kind: "callout", tone: "tip", title: "Corners wait", text: ["Leave the four white corners wherever the cross left them — top layer, bottom layer, doesn't matter. You won't touch a single one until every edge is in."] },
      ],
    },
    {
      id: "insert-edges",
      title: "Insert the edges",
      eyebrow: "Step 1",
      blocks: [
        { kind: "p", text: "With no corners in the way yet, an edge goes in with a very short move. Find a non-yellow edge in the top layer and turn `U` until it sits above the front face. The corners are greyed out in the demos — they get disturbed in passing, and you'll deal with them in the next step." },
        { kind: "p", text: "**Simple inserts: the top sticker matches the front centre.** The edge's front sticker matches the centre on the right or on the left — that tells you which way to send it." },
        {
          kind: "cases",
          cases: [
            solveCase("edge-right", "Goes right", "The edge is above the front face. Its top sticker matches the front centre, its front sticker matches the centre on the right.", "Slot at the front-right.", EDGE("edge-right"), "cross-edge", { note: "Three moves: `R` lifts the slot out of the way, `U'` brings the edge over, `R'` drops it in." }),
            solveCase("edge-left", "Goes left", "The edge is above the front face. Its top sticker matches the front centre, its front sticker matches the centre on the left.", "Slot at the front-left.", EDGE("edge-left"), "cross-edge-left", { note: "The exact mirror of \"goes right\"." }),
          ],
        },
        { kind: "p", text: "**Unoriented edges: the front sticker matches the front centre.** Now the top sticker is a side colour, so the edge is the wrong way round for the simple inserts — they would put it in flipped. The hedgeslammer from the Triggers section inserts it directly, right way round." },
        {
          kind: "cases",
          cases: [
            solveCase("edge-unoriented-right", "Unoriented · goes right", "The edge is above the front face. Its front sticker matches the front centre, its top sticker matches the centre on the right.", "Slot at the front-right.", EDGE("edge-unoriented-right"), "cross-edge", { note: "The hedgeslammer, used directly — no `U` alignment beyond getting the edge above the front face." }),
            solveCase("edge-unoriented-left", "Unoriented · goes left", "The edge is above the front face. Its front sticker matches the front centre, its top sticker matches the centre on the left.", "Slot at the front-left.", EDGE("edge-unoriented-left"), "cross-edge-left", { note: "The left hedgeslammer." }),
          ],
        },
        { kind: "callout", tone: "tip", title: "Oriented or not?", text: ["An edge is **oriented** when its top sticker is the same colour as the front or back centre. An oriented edge can always be inserted with `L`, `U` and `R` moves alone — no `F` or `B`. An **unoriented** edge (top sticker matches a side centre) needs `F` or `B`, which is what the hedgeslammer does."] },
        { kind: "callout", tone: "note", title: "Edge already in the slot, but flipped", text: ["Insert any other top-layer non-yellow edge into that slot with one of the two triggers above — it kicks the wrong edge back out to the top, same fix as Layer by layer. With no corner there yet, ANY spare edge works, not just a yellow one."] },
        { kind: "practice", lessonId: "zeta-slotting", stepId: "zeta-edges", label: "Drill both inserts in the Academy" },
        { kind: "callout", tone: "checkpoint", title: "Checkpoint — cross plus four edges", text: ["All four middle-layer edges seated and correctly oriented. Every corner is still wherever it started — the top layer looks untouched, and that's exactly right."], demo: { setup: SOLVED_SETUP, alg: "", mask: "f2l", label: "Edges done — corners still to come" } },
      ],
    },
    {
      id: "insert-corners",
      title: "Insert the corners",
      eyebrow: "Step 2",
      blocks: [
        { kind: "p", text: "Now go slot by slot. Find the white corner that belongs in a slot whose edge is already seated, turn the top until the corner sits directly above that slot, and read off which way its white sticker points." },
        { kind: "p", text: "Only one of the three cases is a repeated trigger — the other two are genuinely new algorithms. Watch the edge in the demos: every one of them leaves it exactly where it started." },
        {
          kind: "cases",
          cases: [
            solveCase("up", "White up", "The corner sits above its slot, white sticker on top.", "Slot at the front-right.", CORNER("up"), "f2l-pair", { note: "Reverse sexy move, three times. F2L 32." }),
            solveCase("front", "White front", "The corner sits above its slot, white sticker pointing at you.", "Slot at the front-right.", CORNER("front"), "f2l-pair", { note: "F2L 33 — not a repeated trigger, worth drilling on its own." }),
            solveCase("right", "White right", "The corner sits above its slot, white sticker pointing right.", "Slot at the front-right.", CORNER("right"), "f2l-pair", { note: "F2L 34 — the mirror-shaped sibling of \"white front\"." }),
          ],
        },
        { kind: "p", text: "**Left-hand versions.** The same three cases for the front-left slot — the mirror image of each algorithm, so the left hand does the work. Drill both sides so you never regrip to reach a slot." },
        {
          kind: "cases",
          cases: [
            solveCase("left-up", "White up · left slot", "The corner sits above the front-left slot, white sticker on top.", "Slot at the front-left.", CORNER("left-up"), "f2l-pair", { note: "Left reverse sexy move, three times." }),
            solveCase("left-front", "White front · left slot", "The corner sits above the front-left slot, white sticker pointing at you.", "Slot at the front-left.", CORNER("left-front"), "f2l-pair", { note: "The mirror of \"white front\"." }),
            solveCase("left-left", "White left · left slot", "The corner sits above the front-left slot, white sticker pointing left.", "Slot at the front-left.", CORNER("left-left"), "f2l-pair", { note: "The mirror of \"white right\"." }),
          ],
        },
        { kind: "practice", lessonId: "zeta-slotting", stepId: "zeta-corners", label: "Drill the three corner cases in the Academy" },
        { kind: "callout", tone: "checkpoint", title: "Checkpoint — first two layers", text: ["Same finish line as Layer by layer: two full layers solved, every side showing two rows of its own colour under a mixed top row."], demo: { setup: SOLVED_SETUP, alg: "", mask: "f2l", label: "First two layers done" } },
      ],
    },
    {
      id: "last-layer",
      title: "The last layer",
      eyebrow: "Step 3",
      blocks: [
        { kind: "p", text: "Identical to Layer by layer from here — the last layer doesn't know or care which order you built the first two in." },
        { kind: "guideLink", guideId: "last-layer", label: "The last layer, corners first", text: "Four looks, with a drill for each." },
      ],
    },
    {
      id: "next",
      title: "What's next",
      eyebrow: "Keep going",
      blocks: [
        { kind: "p", text: "You've now drilled two of F2L's six \"one piece already in the slot\" case families (the two edge-insert triggers, plus these three corner-insert algorithms) without realising it. Full F2L generalises the same idea to pairs that aren't in a slot at all yet." },
        { kind: "guideLink", guideId: "beginner-f2l", label: "Beginner F2L", text: "Solve the first two layers in pairs — no algorithms to memorise." },
      ],
    },
  ],
};
