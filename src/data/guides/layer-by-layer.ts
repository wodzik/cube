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
import { solveCase, SOLVED_SETUP } from "./helpers";

const SEXY = "R U R' U'";

export const LAYER_BY_LAYER_GUIDE: Guide = {
  id: "layer-by-layer",
  title: "Layer by layer",
  tagline: "The first two layers, the beginner way: white cross, first-layer corners, second-layer edges — mostly intuitive, one trigger to learn.",
  category: "learn",
  readingTime: "~30 min",
  prerequisites: ["getting-started"],
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
        { kind: "p", text: "**Stage 1 — the daisy.** Find a white edge. Depending on where it is, one of these brings it to the top with white facing up. Only the white edges are shown in the demos; the rest of the cube is greyed out." },
        {
          kind: "cases",
          cases: [
            solveCase("daisy-middle", "In the middle layer", "The white sticker faces front (or any side), the edge sits between two centres.", "Hold it at the front-right.", "R U R'", "cross", { note: "Turn the side face up (`R`), move the petal out of the way (`U`), turn the side back (`R'`) so you don't lose anything already on the bottom.", setup: "z2 F2 R U' R'" }),
            solveCase("daisy-bottom-flipped", "On the bottom, white facing sideways", "The edge is already on the bottom layer, but its white sticker is on the side instead of underneath.", "Hold it at the front.", "F' R U R'", "cross", { note: "`F'` lifts it into the middle layer; then it's the case on the left.", setup: "z2 F2 R U' R' F" }),
            solveCase("daisy-top-sideways", "On top, white facing sideways", "The edge is in the top layer but its white sticker points at you instead of up.", "Hold it at the front.", "F R U R'", "cross", { note: "`F` drops it into the middle layer; the rest is the middle-layer case.", setup: "z2 F2 R U' R' F'" }),
            solveCase("daisy-bottom-wrong", "On the bottom, white down, wrong spot", "White faces down but the side colour doesn't match its centre.", "Hold it at the right.", "R2", "cross", { note: "A half turn brings it straight up as a petal.", setup: "z2 F2 U' R2" }),
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
