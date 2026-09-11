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
 * (ZETA_SLOTTING, data/academy.ts) rather than sharing steps with it — its
 * edge step additionally covers the two "unoriented" sledgehammer cases,
 * whose setup disturbs a first-layer corner in passing (harmless here,
 * since corners aren't addressed yet either way, but would look like a
 * broken first layer under the corner-first method).
 *
 * The base two edge-insertion algorithms are still identical text to
 * "Layer by layer"'s second-layer step — sourced from SECOND_LAYER
 * (data/academy.ts) via helpers.academyAlg so the two guides can't drift
 * apart. The sledgehammer and corner-insertion algorithms come from
 * ZETA_SLOTTING the same way.
 */

import type { Guide } from "./types";
import { academyAlg, solveCase, SOLVED_SETUP } from "./helpers";
import { SECOND_LAYER, ZETA_SLOTTING } from "../academy";

const EDGE = (algId: string) => academyAlg("edges", algId, SECOND_LAYER);
const SLEDGE = (algId: string) => academyAlg("zeta-edges", algId, ZETA_SLOTTING);
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
        { kind: "p", text: "With no corners in the way yet, this is identical to Layer by layer's second-layer step: find a non-yellow edge in the top layer, line its front sticker up with the matching centre, then send it right or left depending on which centre its top sticker matches." },
        {
          kind: "cases",
          cases: [
            solveCase("edge-right", "Goes right", "Front sticker matches the front centre; the top sticker matches the centre on the right.", "The matching T at the front.", EDGE("edge-right"), "cross-edge", { note: "Same two triggers as Layer by layer's second-layer step." }),
            solveCase("edge-left", "Goes left", "Front sticker matches the front centre; the top sticker matches the centre on the left.", "The matching T at the front.", EDGE("edge-left"), "cross-edge", { note: "The exact mirror of \"goes right\"." }),
          ],
        },
        { kind: "p", text: "Sometimes neither side face shows the front colour at all — the edge's front-colour sticker is sitting on TOP instead, so no amount of turning U lines it up the normal way. The sledgehammer inserts it directly, no alignment needed." },
        {
          kind: "cases",
          cases: [
            solveCase("edge-unoriented-right", "Unoriented · right", "The edge sits at the top-right with its front-colour sticker on top, not on a side face.", "Slot at the front-right.", SLEDGE("edge-unoriented-right"), "cross-edge", { note: "The sledgehammer, used directly — no U alignment first." }),
            solveCase("edge-unoriented-left", "Unoriented · left", "Mirrored: the edge sits at the top-left with its front-colour sticker on top.", "Slot at the front-left.", SLEDGE("edge-unoriented-left"), "cross-edge", { note: "The left sledgehammer." }),
          ],
        },
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
        { kind: "callout", tone: "tip", title: "Left-hand version", text: ["Same three cases work on the front-left slot with the left sexy move family: `(U' L' U L)` repeated three times for \"white up\", and the mirrored 8-move algorithms for the other two."] },
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
