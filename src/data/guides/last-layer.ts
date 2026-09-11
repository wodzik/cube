/**
 * "The last layer, corners first" — the 4-look last layer this app
 * teaches: orient corners with F (sexy)ⁿ F', Sune/Antisune and the A / B
 * blocks; orient edges (OLL 28/57/20); permute corners with A + B / B + A;
 * permute edges (Ua/Ub/H/Z). Every algorithm comes straight from the
 * Academy lesson (data/academy.ts) via academyAlg(), so guide and drill
 * can't drift apart, and each section links into the matching drill step.
 *
 * Recognition text was written from the engine's description of each case
 * scene (which yellow stickers face where) and is pinned by guides.test.ts.
 */

import type { Guide } from "./types";
import { academyAlg, solveCase, SOLVED_SETUP } from "./helpers";

const CO = (algId: string) => academyAlg("co", algId);
const EO = (algId: string) => academyAlg("eo", algId);
const CP = (algId: string) => academyAlg("cp", algId);
const EP = (algId: string) => academyAlg("epll", algId);

export const LAST_LAYER_GUIDE: Guide = {
  id: "last-layer",
  title: "The last layer, corners first",
  tagline: "Four looks — orient the corners, orient the edges, permute the corners, permute the edges — built from the sexy move and two blocks, A and B, that do double duty.",
  category: "learn",
  readingTime: "~30 min",
  prerequisites: ["layer-by-layer"],
  intro: [
    "With two layers done, the last layer is solved in two phases — first make the top yellow (**orientation**), then move the pieces into their right spots (**permutation**) — and in each phase we do the **corners first, then the edges**. That's four looks at the cube, with a short algorithm each time.",
    "There are fewer algorithms than it looks. Three of the corner cases are the same trigger repeated; the two permutation algorithms are just two building blocks, A and B, chained in either order. Each section ends with a button that opens the matching Academy drill.",
  ],
  sections: [
    {
      id: "four-looks",
      title: "Four looks",
      eyebrow: "Overview",
      blocks: [
        { kind: "list", ordered: true, items: ["**Orient the corners** — get all four corner yellow stickers facing up.", "**Orient the edges** — get the edge yellow stickers up too; the whole top is yellow.", "**Permute the corners** — move the corners into their correct spots.", "**Permute the edges** — cycle the edges home; solved."] },
        { kind: "p", text: "The trick of this method: look 1 teaches you two building blocks, **A** and **B**. Look 3 doesn't need anything new — its two algorithms are literally A followed by B, and B followed by A." },
        { kind: "callout", tone: "tip", title: "Headlights", text: ["Two corners next to each other whose yellow stickers both point out of the **same** side look like a pair of headlights. Several cases are recognised by where the headlights are — and \"hold the headlights on the left\" means turn the whole cube (not just the top) so that side is on your left."] },
      ],
    },
    {
      id: "orient-corners",
      title: "Orient the corners",
      eyebrow: "Look 1",
      blocks: [
        { kind: "p", text: "Ignore the edges completely for now — the demos hide them. Look only at the four corners of the top layer and count how many already have yellow on top, then find the case below; every one tells you how to hold the cube." },
        { kind: "p", text: "Three of the cases are the same idea: an `F`, then the sexy move one, two or three times, then `F'`. Two are the well-known Sune and Antisune. The last two are blocks **A** (sexy move + sledgehammer) and **B** — the ones look 3 reuses, so learn them cold." },
        {
          kind: "cases",
          cases: [
            solveCase("co-headlights", "Two done · headlights", "Two corners have yellow up. The other two are next to each other, and their yellow stickers point out of the same side.", "Headlights on the left.", CO("sexy1"), "ll-corners-orient", { note: "One sexy move inside F … F'." }),
            solveCase("co-a", "Two done · opposite ways", "Two corners have yellow up. The other two are next to each other, but one yellow sticker points at you and the other away from you.", "Those two corners on the left, the one pointing at you at the front.", CO("block-a"), "ll-corners-orient", { note: "Block A — sexy move + sledgehammer. Remember this one." }),
            solveCase("co-b", "Two done · diagonal", "Two corners have yellow up, and they're diagonally opposite each other.", "A twisted corner at the front-left with its yellow facing you; the other twisted corner is then at the back-right with its yellow facing right.", CO("block-b"), "ll-corners-orient", { note: "Block B. Remember this one too." }),
            solveCase("co-sune", "One done · Sune", "One corner has yellow up, and the front-right corner's yellow sticker faces you when the done corner is at the front-left.", "Done corner at the front-left, front-right corner showing yellow to the front.", CO("sun"), "ll-corners-orient"),
            solveCase("co-antisune", "One done · Antisune", "One corner has yellow up, and the front-right corner's yellow sticker faces right when the done corner is at the back-right.", "Done corner at the back-right, front-right corner showing yellow to the right.", CO("antisun"), "ll-corners-orient", { note: "If you can only see one done corner but the front-right yellow faces the other way, you're holding it for Sune — turn the cube a quarter and check again." }),
            solveCase("co-pi", "None done · one pair of headlights", "No corner has yellow up. One side shows headlights; the other two yellow stickers point front and back.", "Headlights on the left.", CO("sexy2"), "ll-corners-orient", { note: "Two sexy moves inside F … F'." }),
            solveCase("co-h", "None done · two pairs of headlights", "No corner has yellow up. Headlights at the front and at the back; nothing on the left or right.", "Headlights facing you and away from you.", CO("sexy3"), "ll-corners-orient", { note: "Three sexy moves inside F … F'." }),
          ],
        },
        { kind: "practice", lessonId: "4lll-corners-first", stepId: "co", label: "Drill these seven in the Academy" },
        { kind: "callout", tone: "checkpoint", title: "Checkpoint — corners oriented", text: ["All four corners show yellow on top. The edges can still be anything — we haven't touched them on purpose."], demo: { setup: SOLVED_SETUP, alg: "", mask: "ll-corners-orient", label: "Four yellow corners" } },
      ],
    },
    {
      id: "orient-edges",
      title: "Orient the edges",
      eyebrow: "Look 2",
      blocks: [
        { kind: "p", text: "Now the edges. With the corners done, either zero, two or all four of the top edges still have their yellow sticker on the side. Both two-edge cases use one algorithm each; they contain the wide turn `r` and the slice `M` — see Getting started if those are new." },
        {
          kind: "cases",
          cases: [
            solveCase("eo-adjacent", "Two flipped, next to each other", "Two edges next to each other show yellow on the side.", "The flipped edges at the front and the right.", EO("oll28"), "ll-orient", { note: "OLL 28." }),
            solveCase("eo-opposite", "Two flipped, opposite", "Two edges opposite each other show yellow on the side.", "The flipped edges at the front and the back.", EO("oll57"), "ll-orient", { note: "OLL 57." }),
            solveCase("eo-all", "All four flipped", "No edge has yellow up.", "Any way.", EO("oll20"), "ll-orient", { note: "OLL 20 — or do the adjacent-case algorithm from any angle, then finish with whichever case remains." }),
          ],
        },
        { kind: "practice", lessonId: "4lll-corners-first", stepId: "eo", label: "Drill the edge cases in the Academy" },
        { kind: "callout", tone: "checkpoint", title: "Checkpoint — top face yellow", text: ["The whole top face is yellow. The sides of the top layer are still mixed up — that's the next two looks."], demo: { setup: SOLVED_SETUP, alg: "", mask: "ll-orient", label: "Top face complete" } },
      ],
    },
    {
      id: "permute-corners",
      title: "Permute the corners",
      eyebrow: "Look 3",
      blocks: [
        { kind: "p", text: "The top is yellow; now the corners have to go to their right spots. A corner is **correct** when its two side stickers match the two centres next to it. Turn the top layer (`U` turns only) and look for correct corners — you'll find either two next to each other, two diagonally opposite, or all four." },
        { kind: "p", text: "Two corners next to each other that are both correct show the same colour on their shared side: **headlights** again. That's the fastest way to spot them." },
        {
          kind: "cases",
          cases: [
            solveCase("cp-adjacent", "Two correct, next to each other", "One side shows headlights; the other two corners need to swap.", "Headlights on the left.", CP("a-plus-b"), "ll-corners", { note: "A then B. It swaps the two corners on the right. (Speedcubers know it as the T permutation.)" }),
            solveCase("cp-diagonal", "Two correct, diagonal", "No headlights on any side; the two wrong corners are diagonally opposite.", "The correct corners at the front-left and back-right.", CP("b-plus-a"), "ll-corners", { note: "B then A. It swaps the front-right and back-left corners. (The Y permutation.)" }),
          ],
        },
        { kind: "callout", tone: "note", text: ["Can't find any correct corners? Keep turning the top — one of the four positions always has at least two. All four correct: skip to look 4."] },
        { kind: "practice", lessonId: "4lll-corners-first", stepId: "cp", label: "Drill A + B and B + A in the Academy" },
        { kind: "callout", tone: "checkpoint", title: "Checkpoint — corners placed", text: ["Turn the top until every corner matches the centres. All four corners are now solved; only the four top edges are left."], demo: { setup: SOLVED_SETUP, alg: "", mask: "ll-corners", label: "Corners solved" } },
      ],
    },
    {
      id: "permute-edges",
      title: "Permute the edges",
      eyebrow: "Look 4",
      blocks: [
        { kind: "p", text: "The last look. With the corners in place, count how many top edges already match their centres. Either one does (the other three cycle), or none do (two pairs swap)." },
        {
          kind: "cases",
          cases: [
            solveCase("ep-ua", "One correct · front edge belongs right", "One edge matches; of the other three, the one at the front belongs on the right.", "The correct edge at the back.", EP("ua"), "ll", { note: "Ua permutation." }),
            solveCase("ep-ub", "One correct · front edge belongs left", "One edge matches; the one at the front belongs on the left.", "The correct edge at the back.", EP("ub"), "ll", { note: "Ub permutation." }),
            solveCase("ep-h", "None correct · opposite swaps", "Front and back need to swap, and left and right need to swap.", "Any way.", EP("h"), "ll", { note: "H permutation." }),
            solveCase("ep-z", "None correct · neighbour swaps", "Two pairs of neighbouring edges need to swap.", "So that front↔left and back↔right are the swaps.", EP("z"), "ll", { note: "Z permutation. Not sure which way to hold it? Do it once, then it's a Ua/Ub case." }),
          ],
        },
        { kind: "practice", lessonId: "4lll-corners-first", stepId: "epll", label: "Drill the edge permutations in the Academy" },
        { kind: "callout", tone: "checkpoint", title: "Solved!", text: ["Turn the top to line everything up. That's the whole cube."], demo: { setup: SOLVED_SETUP, alg: "", mask: "full", label: "Done" } },
      ],
    },
    {
      id: "next",
      title: "What's next",
      eyebrow: "Keep going",
      blocks: [
        { kind: "p", text: "Solve it ten more times. The first two layers will get faster on their own; the last layer gets faster by drilling the algorithms until your hands do them without thinking." },
        { kind: "list", items: ["**Time yourself** in the Solve tab — with a smart cube it detects the solve automatically.", "**Drill the last layer** in the Academy: each look above has its own practice mode.", "**Learn F2L** to solve the first two layers in pairs — the single biggest speed-up after this method."] },
        { kind: "guideLink", guideId: "beginner-f2l", label: "Beginner F2L", text: "Solve the first two layers in pairs — no algorithms to memorise." },
      ],
    },
  ],
};
