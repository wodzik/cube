/**
 * "Beginner F2L" — first two layers in corner+edge pairs. Four basic
 * inserts (matched / split, right / left hand) plus a handful of set-up
 * cases, each of which is deliberately chosen so that its algorithm is
 * literally "a few set-up moves" + "one of the four basic inserts" — the
 * `note` on each case spells that decomposition out, and it's guaranteed
 * by construction: the scene after the set-up moves IS the basic insert's
 * own scene (a state solved by alg X is the inverse of X applied to solved,
 * which is unique).
 *
 * Every demo uses the same pair — white/green/orange, into the front-right
 * slot (between the green and orange centres, white on the bottom) — with
 * the other three pairs dimmed and the last layer hidden.
 */

import type { Guide, GuideCase } from "./types";
import { guideSetup } from "./helpers";

function pairCase(id: string, name: string, recognise: string, hold: string | undefined, alg: string, note?: string): GuideCase {
  return { id, name, recognise, hold, alg, note, demo: { setup: guideSetup(alg), alg, mask: "f2l-pair", tryOnCube: true } };
}

export const BEGINNER_F2L_GUIDE: Guide = {
  id: "beginner-f2l",
  title: "Beginner F2L",
  tagline: "Solve the first two layers in corner–edge pairs. Four inserts and a few set-up moves cover every case — nothing to memorise.",
  category: "learn",
  readingTime: "~45 min",
  prerequisites: ["layer-by-layer"],
  intro: [
    "In the beginner method you solve the first layer's corners, then the second layer's edges — eight pieces, one at a time. F2L (\"first two layers\") solves the same eight pieces as four **pairs**: a corner and the edge that belongs next to it, joined on top and inserted together. It's the same cube and the same slots, just fewer, smarter moves.",
    "Don't learn this page as a list of algorithms. Read what each move sequence is **doing** — opening a slot, moving a piece out of the way, closing it — and the 41 \"cases\" collapse into a few ideas you can work out at the cube.",
  ],
  sections: [
    {
      id: "what",
      title: "What is F2L?",
      eyebrow: "The idea",
      blocks: [
        { kind: "p", text: "After the cross, each of the four corners of the first layer has exactly one middle-layer edge that belongs directly above it. Together they fill one **slot** — the front-right slot is the space between the green and orange centres, above the green-orange cross edge. F2L is: get the corner and its edge next to each other in the top layer, so they form a pair, then drop the pair into its slot with three or four moves." },
        { kind: "p", text: "Everything below is shown on one pair — white/green/orange, going into the front-right slot. The other three pairs are already solved and dimmed, and the last layer is hidden: **while you're doing F2L, the top layer doesn't matter**. Turn it as much as you like." },
        { kind: "callout", tone: "tip", title: "Every case has a mirror", text: ["Everything here is shown for the front-right slot with the right hand. The same situation on the front-left slot uses the mirror: swap `R` for `L'`, `R'` for `L`, `U` for `U'` — the left-hand versions of the two basic inserts are listed explicitly so you can see the pattern."] },
      ],
    },
    {
      id: "inserts",
      title: "The two basic inserts",
      eyebrow: "Step 1",
      blocks: [
        { kind: "p", text: "A pair sitting in the top layer is in one of two shapes. **Matched:** the corner and edge are next to each other and their colours line up — from the side you see a 2×1 block of one colour, from the top another. **Split:** the corner is above its slot and the edge is across the top layer from it, not touching." },
        {
          kind: "cases",
          cases: [
            pairCase("matched-right", "Matched pair, right hand", "The pair is joined at the front-right of the top layer; the corner's white sticker faces you, and the edge sits to its right with the colours lined up.", "Slot at the front-right.", "U R U' R'", "Move the pair away from the slot (`U`), open the slot (`R`), bring the pair over it (`U'`), close (`R'`). This is the reverse sexy move."),
            pairCase("matched-left", "Matched pair, left hand", "Same shape, mirrored: the pair is at the front-left, white facing you, edge to its left.", "Slot at the front-left.", "U' L' U L", "The exact mirror: `U'`, open with `L'`, `U`, close with `L`."),
            pairCase("split-right", "Split pair, right hand", "The corner is above its slot with white facing right; the edge is at the back of the top layer, green (the front colour) facing up.", "Slot at the front-right.", "R U R'", "Open the slot (`R`) — the corner swings up to the back; the edge comes over (`U`) and joins it; close (`R'`) and the pair drops in."),
            pairCase("split-left", "Split pair, left hand", "Mirrored: corner above the front-left slot with white facing left; edge at the back, green facing up.", "Slot at the front-left.", "L' U' L", "Mirror of the split insert."),
          ],
        },
        { kind: "callout", tone: "note", text: ["Notice that the two inserts differ only in which way the corner's white sticker points: **towards you** → matched insert (`U R U' R'`), **to the side** → split insert (`R U R'`). The edge just has to be in the right place for that insert."] },
      ],
    },
    {
      id: "setup",
      title: "Setting up the pair",
      eyebrow: "Step 2",
      blocks: [
        { kind: "p", text: "Most of the time the pair isn't ready to insert. Then you spend a few moves getting it into one of the two shapes above — and every set-up below ends in exactly one of the four basic inserts. Read the note under each case: it names the set-up moves and the insert they lead to." },
        { kind: "p", text: "**A piece is stuck in the slot.** Pull it out with the same moves you'd use to insert — `R U R'` or `R U' R'` — choosing the direction that makes it land next to its partner." },
        {
          kind: "cases",
          cases: [
            pairCase("corner-in-slot-right", "Corner in the slot, white facing right", "The corner is in its slot but twisted (white on the side, pointing right); the edge is on top at the right, green facing up.", "Slot at the front-right.", "R U R' U' R U R'", "`R U R'` pulls the corner out; one `U'` lines the edge up, and `R U R'` is the **split insert**."),
            pairCase("corner-in-slot-front", "Corner in the slot, white facing you", "The corner is in its slot twisted the other way (white pointing at you); the edge is on top at the right, green facing up.", "Slot at the front-right.", "R U' R' U R U' R'", "`R U' R'` pulls the corner out and it lands next to the edge as a **matched pair**; `U R U' R'` inserts it."),
            pairCase("edge-in-slot", "Edge in the slot, corner on top", "The edge is already in the slot (the right way round, even); the corner is above the slot with white facing you.", "Slot at the front-right.", "U' R U' R' U2 R U' R'", "`U' R U' R'` brings the edge out and it joins the corner as a **matched pair**; `U2 R U' R'` is the matched insert with an extra `U` to line up."),
            pairCase("both-in-slot", "Both in the slot, corner twisted", "The pair is in its slot but the corner's white sticker points right.", "Slot at the front-right.", "R U' R' U R U2 R' U R U' R'", "Three parts: `R U' R'` takes the pair out, `U R U2 R'` joins the two pieces, `U R U' R'` is the **matched insert**."),
          ],
        },
        { kind: "p", text: "**The pieces are apart on top.** Join them first: bring the corner up out of the slot's way, slide the edge next to it, put the corner back. Then insert." },
        {
          kind: "cases",
          cases: [
            pairCase("apart-white-front", "Corner white facing you, edge at the back", "The corner is above its slot with white facing you; the edge is at the back of the top layer, green facing up.", "Slot at the front-right.", "U' R U R' U2 R U' R'", "`U' R U R'` joins them into a **matched pair** (the corner dips into the slot while the edge slides next to it); then `U2 R U' R'` — the matched insert plus a `U` to line up."),
            pairCase("apart-white-right", "Corner white facing right, edge at the left", "The corner is above its slot with white facing right; the edge is at the left of the top layer, green facing up.", "Slot at the front-right.", "U' R U R' U R U R'", "`U' R U R'` joins them; `U R U R'` is a `U` to line up and then the **split insert**."),
            pairCase("joined-wrong", "Joined, but the colours don't match", "The corner and edge are next to each other at the front-right, but the corner's white faces right and the colours don't line up.", "Slot at the front-right.", "U' R U' R' U R U R'", "`U' R U' R'` separates them and re-joins them properly; `U R U R'` lines up and does the **split insert**."),
          ],
        },
        { kind: "p", text: "**White facing up.** The awkward one: with white on top, neither basic insert applies directly. Turn the corner first — a `R U2 R'`-style move flips it to white-on-the-side — then it's a normal case." },
        {
          kind: "cases",
          cases: [
            pairCase("white-up-edge-right", "White up, edge at the right", "The corner is above its slot with white facing up; the edge is at the right of the top layer, green facing up.", "Slot at the front-right.", "R U2 R' U' R U R'", "`R U2 R'` turns the corner so white faces the side; `U' R U R'` lines up and does the **split insert**."),
            pairCase("white-up-edge-left", "White up, edge at the left", "The corner is above its slot with white facing up; the edge is at the left of the top layer, green facing up.", "Slot at the front-right.", "U2 R U R' U R U' R'", "`U2 R U R'` joins the two pieces into a **matched pair**; `U R U' R'` inserts it."),
          ],
        },
        { kind: "callout", tone: "warning", title: "Slower at first — normal", text: ["Switching from the beginner method to F2L makes you slower for a week or two while you learn to see pairs. Stick with it: after that it's the biggest single speed-up you'll ever get."] },
      ],
    },
    {
      id: "practice",
      title: "How to practise",
      eyebrow: "Step 3",
      blocks: [
        { kind: "list", items: ["**Solve slowly and look.** Before each pair, find both pieces and say which basic insert you're heading for. Speed comes later.", "**One slot at a time.** The Skill Trainers tab has F2L drills that scramble a single pair over a solved cross, so you can repeat the recognition without doing a whole solve.", "**The full case list** lives in the Drill Algorithms tab (F2L, 41 cases) once you want optimal solutions for each situation — but you can be fast without ever opening it."] },
      ],
    },
    {
      id: "next",
      title: "What's next",
      eyebrow: "Keep going",
      blocks: [
        { kind: "p", text: "With F2L in place, the last layer becomes the bottleneck. The corners-first last layer is a good place to stay for a while; the Academy drills each of its four looks." },
        { kind: "guideLink", guideId: "last-layer", label: "The last layer, corners first", text: "Four looks, with a drill for each." },
        { kind: "guideLink", guideId: "getting-started", label: "Getting started", text: "Wide turns, slices and rotations, for when the algorithms get longer." },
      ],
    },
  ],
};
