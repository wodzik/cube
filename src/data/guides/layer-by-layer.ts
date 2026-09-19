/**
 * "Layer by layer" — the beginner method's first two layers: white cross
 * (intuitive, daisy first), first-layer corners (the sexy move, repeated),
 * second-layer edges (two mirrored inserts). The last layer is its own
 * guide (last-layer.ts).
 *
 * Demo scenes are "z2 + inverse of the alg" (see helpers.guideSetup):
 * white on the bottom, and playing the alg ends solved. The recognition
 * text for every case was written from the engine's own description of
 * that scene (which stickers face where) — see guides.test.ts for the
 * invariants each group must satisfy.
 */

import type { Guide } from "./types";
import { previewOf, solveCase, SOLVED_SETUP } from "./helpers";

const SEXY = "R U R' U'";

export const LAYER_BY_LAYER_GUIDE: Guide = {
  id: "layer-by-layer",
  title: "Layer by layer",
  tagline: "The first two layers, the beginner way: white cross, first-layer corners, second-layer edges — mostly intuitive, one trigger to learn.",
  category: "learn",
  readingTime: "~30 min",
  prerequisites: ["getting-started"],
  // The "white facing up" corner: three sexy moves, first layer in colour.
  preview: previewOf(`(${SEXY}) (${SEXY}) (${SEXY})`, "first-layer"),
  intro: [
    "Three steps take a scrambled cube to two solved layers. The cross is worked out piece by piece with no algorithms; the corners use one four-move trigger repeated; the second layer uses two mirrored sequences. Everything is shown with white on the bottom and yellow on top — keep holding it that way.",
    "Work through it with a cube in your hands. Every case has a 3D demo you can play, and a \"Try this\" button that tracks the moves on a connected smart cube. Checkpoints tell you what the cube should look like before you move on.",
  ],
  sections: [
    {
      id: "cross",
      title: "The white cross",
      eyebrow: "Step 1",
      blocks: [
        { kind: "p", text: "**Goal:** the four white edges on the bottom, forming a plus, with each edge's other colour matching the centre next to it. This is the one step with no algorithms — you work it out edge by edge, and it gets easier every solve." },
        { kind: "p", text: "The easiest route is in two stages. First make a **daisy**: get all four white edges around the yellow centre on top, white stickers facing up. Then turn each petal down onto the bottom." },
        { kind: "p", text: "**Stage 1 — the daisy.** Find a white edge and bring it to the top, white facing up, next to the yellow centre. If you ignore every other piece — nothing you've already placed needs protecting — a white edge gets there in **one move, or two at most**. The demos below show only the centres and that one white edge; the rest of the cube is greyed out." },
        { kind: "p", text: "**One move: the edge is in the middle layer.** Turn the face that carries the edge's *coloured* sticker, in the direction that lifts the edge to the top — the white sticker rides up with it." },
        {
          kind: "cases",
          cases: [
            solveCase("daisy-mid-right", "Middle layer, front-right", "The edge sits in the middle layer at the front-right. Its white sticker faces you, the other colour faces right.", undefined, "R", "white-edge-0", { note: "The coloured sticker is on the right face, so turn `R`: the edge rides up to the top.", setup: "z2 D R" }),
            solveCase("daisy-mid-left", "Middle layer, front-left", "The edge sits in the middle layer at the front-left. Its white sticker faces you, the other colour faces left.", undefined, "L'", "white-edge-0", { note: "The mirror image: the coloured sticker is on the left face, so turn `L'`.", setup: "z2 D' L'" }),
            solveCase("daisy-mid-front", "Middle layer, white facing sideways", "The edge sits in the middle layer at the front-left, but its white sticker points left; the other colour faces you.", undefined, "F", "white-edge-0", { note: "This time the coloured sticker is on the front face, so turn `F`.", setup: "z2 F" }),
          ],
        },
        { kind: "p", text: "**Half turns count as one move.** An edge on the bottom layer with its white sticker facing down needs just one half turn of the face it's on:" },
        {
          kind: "cases",
          cases: [
            solveCase("daisy-half-right", "Bottom, at the right", "The edge is on the bottom layer at the right, white facing down.", undefined, "R2", "white-edge-0", { setup: "z2 D" }),
            solveCase("daisy-half-left", "Bottom, at the left", "The edge is on the bottom layer at the left, white facing down.", undefined, "L2", "white-edge-0", { setup: "z2 D'" }),
            solveCase("daisy-half-front", "Bottom, at the front", "The edge is on the bottom layer at the front, white facing down.", undefined, "F2", "white-edge-0", { setup: "z2" }),
          ],
        },
        { kind: "p", text: "**Two moves: white facing sideways at the top or bottom.** No single turn lifts these. Make the first move `F` or `F'` to drop the edge into the middle layer — that turns it into one of the one-move cases above — and finish with that move." },
        {
          kind: "cases",
          cases: [
            solveCase("daisy-bottom-flipped", "On the bottom, white facing sideways", "The edge is on the bottom layer at the front, but its white sticker faces you instead of down.", undefined, "F' R", "white-edge-0", { note: "`F'` sends it to the middle layer at the front-right, white still facing you — the first one-move case, so `R` finishes it. Going the other way works just as well: `F`, then `L'`.", setup: "z2 D R F" }),
            solveCase("daisy-top-sideways", "On top, white facing sideways", "The edge is in the top layer at the front, but its white sticker faces you instead of up.", undefined, "F R", "white-edge-0", { note: "`F` drops it into the middle layer at the front-right, white still facing you — then `R` lifts it. The mirror route: `F'`, then `L'`.", setup: "z2 D R F'" }),
          ],
        },
        { kind: "p", text: "**When petals are in the way.** Once some petals are up, a plain lift would knock one of them back down. Turn `U` first to slide the petals aside, so the slot the edge is heading for is empty — every top edge is shown from here on." },
        {
          kind: "cases",
          cases: [
            solveCase("daisy-blocked-one", "A petal in the way", "Three petals are up. The fourth white edge is in the middle layer at the front-right, white facing you — but `R` alone would push the petal above it out of the top layer.", undefined, "U' R", "cross", { note: "`U'` turns the top until the gap between the petals sits above the edge, then `R` lifts it into the gap. That's the daisy.", setup: "z2 R2 L2 B2 D U' R U" }),
            solveCase("daisy-blocked-two", "Two moves, both in the way", "Three petals are up and the last white edge is on the bottom, white facing you. It needs `F'` then `R` — and each of them would push a petal out of the top layer.", undefined, "U' F' U' R", "cross", { note: "Clear the top before **each** lifting move: `U'` so the front-top slot is empty for `F'`, then `U'` again so the front-right one is empty for `R`.", setup: "z2 R2 L2 B2 D U' R U F U" }),
          ],
        },
        { kind: "p", text: "**Stage 2 — daisy to cross.** Take any petal. Turn the top (`U`) until the petal's **side** colour sits directly above the centre of the same colour. Then turn that face twice: the petal goes down onto the bottom, white facing down, side colour matching. Repeat for all four." },
        {
          kind: "cases",
          cases: [
            solveCase("cross-aligned", "Petal above its centre", "The petal's side colour matches the centre right below it.", "Hold that side at the front.", "F2", "cross", { setup: "z2 F2" }),
            solveCase("cross-unaligned", "Petal above the wrong centre", "The petal's side colour doesn't match the centre below it.", undefined, "U' F2", "cross", { note: "Turn the top until it matches, then the half turn.", setup: "z2 F2 U" }),
          ],
        },
        { kind: "p", text: "**A trickier daisy.** Sometimes no petal is lined up the easy way. Don't plan all four at once — do the same two-step rhythm once per petal: `U` until one petal is above its own centre, `F2` to send it down, then turn the whole cube (`y`) so the next centre faces you and repeat." },
        {
          kind: "cases",
          cases: [
            solveCase("cross-advanced", "All four petals, two swapped", "All four petals are up. Two of them sit above their own centres; the other two are swapped with each other.", undefined, "U F2 y U2 F2 y U F2 y F2", "cross", { note: "Each `F2` sends one petal down; the `y` between them brings the next centre to the front. The cube ends turned a quarter — that's fine, the cross is what matters.", setup: "z2 R2 U B2 U F2 U' L2" }),
          ],
        },
        { kind: "callout", tone: "checkpoint", title: "Checkpoint — white cross", text: ["A white plus on the bottom, and around the sides, each cross edge's colour matches the centre above it (green edge under the green centre, and so on). A white plus whose side colours don't match the centres is not a cross yet — turn the petals back up and redo those."], demo: { setup: SOLVED_SETUP, alg: "", mask: "cross", view: "bottom", label: "The finished cross, seen from below" } },
      ],
    },
    {
      id: "corners",
      title: "First-layer corners",
      eyebrow: "Step 2",
      blocks: [
        { kind: "p", text: "**Goal:** the four white corners into the bottom layer, completing the white face and the first layer of colours around it." },
        { kind: "p", text: "Find a white corner in the top layer. Its two other colours tell you where it belongs: between those two centres. Turn the top (`U`) until the corner sits directly above that spot, then hold the cube so that spot is at the **front-right**. Now the sexy move `R U R' U'` — repeated — drops it in. How many times depends on where the white sticker is pointing:" },
        {
          kind: "cases",
          cases: [
            solveCase("corner-right", "White facing right", "The corner is above its slot, white sticker pointing right.", "Slot at the front-right.", `(${SEXY})`, "first-layer", { note: "One sexy move." }),
            solveCase("corner-up", "White facing up", "The corner is above its slot, white sticker on top.", "Slot at the front-right.", `(${SEXY}) (${SEXY}) (${SEXY})`, "first-layer", { note: "Three sexy moves. Watch the corner: it goes in, comes out, goes in again the right way." }),
            solveCase("corner-front", "White facing you", "The corner is above its slot, white sticker pointing at you.", "Slot at the front-right.", "U R U' R'", "first-layer", { note: "This is the reverse sexy move — one trigger instead of five sexy moves (which also works)." }),
            solveCase("corner-stuck", "Corner in the slot, but wrong", "A white corner is in the bottom layer but twisted, or in the wrong slot.", "That slot at the front-right.", `(${SEXY})`, "first-layer", { note: "One sexy move pops it out to the top layer. Then it's one of the three cases above.", setup: "z2 R U R' U' R U R' U'" }),
          ],
        },
        { kind: "callout", tone: "tip", title: "Left-hand version", text: ["If it's more comfortable, do the same with the slot at the front-**left** and the left sexy move `L' U' L U` — the counts are the same, with \"white facing left\" as the one-trigger case."] },
        { kind: "practice", lessonId: "two-first-layers", stepId: "corners", label: "Drill the corner cases in the Academy" },
        { kind: "callout", tone: "checkpoint", title: "Checkpoint — first layer", text: ["The whole white face is done and the bottom row of every side is a single colour matching its centre."], demo: { setup: SOLVED_SETUP, alg: "", mask: "first-layer", view: "bottom", label: "First layer complete, seen from below" } },
      ],
    },
    {
      id: "second-layer",
      title: "Second-layer edges",
      eyebrow: "Step 3",
      blocks: [
        { kind: "p", text: "**Goal:** the four edges of the middle layer. They're the edges with **no yellow** on them — every yellow edge belongs to the last layer and can wait. The demos show the first two layers in colour and grey out the last layer: that's exactly what you should be looking at." },
        { kind: "p", text: "Find a non-yellow edge in the top layer. Turn the top (`U`) until its **front** sticker matches the centre below it — the edge and the centre form an upside-down T. Now look at the edge's **top** sticker: it matches either the centre on the right or the centre on the left. That's where the edge goes." },
        {
          kind: "cases",
          cases: [
            solveCase("edge-right", "Goes right", "Front sticker matches the front centre; the top sticker matches the centre on the right.", "The matching T at the front.", "U R U' R' U' F' U F", "f2l", { note: "Move it away from the slot (`U`), bring the slot up and back down with the edge next to it — it's two triggers in a row." }),
            solveCase("edge-left", "Goes left", "Front sticker matches the front centre; the top sticker matches the centre on the left.", "The matching T at the front.", "U' L' U L U F U' F'", "f2l", { note: "The exact mirror of \"goes right\"." }),
          ],
        },
        { kind: "practice", lessonId: "two-first-layers", stepId: "edges", label: "Drill both inserts in the Academy" },
        { kind: "callout", tone: "note", title: "Edge in the slot but wrong", text: ["If a middle-layer edge is already in a slot but flipped or in the wrong place, insert any top-layer non-yellow edge into that slot with one of the two sequences above. That kicks the wrong edge out to the top, where you can handle it normally. If no top-layer edge is available, insert a yellow one — it's only there to do the kicking."] },
        { kind: "callout", tone: "checkpoint", title: "Checkpoint — first two layers", text: ["Two full layers solved: every side shows two rows of its own colour under a mixed top row."], demo: { setup: SOLVED_SETUP, alg: "", mask: "f2l", label: "First two layers done — only the top layer left" } },
      ],
    },
    {
      id: "next",
      title: "What's next",
      eyebrow: "Keep going",
      blocks: [
        { kind: "p", text: "Two layers down. The last layer is where the algorithms are — but fewer than it looks, and most of them are the sexy move again." },
        { kind: "guideLink", guideId: "last-layer", label: "Next: The last layer, corners first", text: "Four looks: orient corners, orient edges, permute corners, permute edges." },
        { kind: "guideLink", guideId: "beginner-f2l", label: "Later: Beginner F2L", text: "Once you can solve, replace steps 2 and 3 with pairs — the biggest speed-up after the beginner method." },
      ],
    },
  ],
};
