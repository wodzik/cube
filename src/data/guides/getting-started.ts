/**
 * "Getting started" — what to know before the first solve: the pieces,
 * how to hold the cube, the move alphabet, and the four-move triggers the
 * rest of the guides are built from. The A / B blocks are deliberately NOT
 * here — they're introduced where they're used, in the last-layer guide.
 */

import type { Guide, GuideCase, GuideDemo } from "./types";

const loop = (alg: string, label = alg): GuideDemo => ({ alg, label, loop: true, repeat: 60 });

const trigger = (id: string, name: string, alg: string, recognise: string, note?: string): GuideCase => ({
  id,
  name,
  recognise,
  alg,
  demo: { alg, loop: true, repeat: 6, tryOnCube: true },
  note,
});

export const GETTING_STARTED_GUIDE: Guide = {
  id: "getting-started",
  title: "Getting started",
  tagline: "The pieces, how to hold the cube, how moves are written, and the four-move triggers every algorithm in this app is built from.",
  category: "learn",
  readingTime: "~20 min",
  intro: [
    "Ten minutes here saves an hour later. This guide covers what a cube actually is (fewer moving parts than it looks), the one way of holding it that all the other guides assume, and the tiny alphabet algorithms are written in.",
    "You don't need to memorise the notation up front — come back whenever a guide uses a symbol you haven't seen.",
  ],
  hero: { alg: "R U R' U'", loop: true, repeat: 6, label: "R U R' U' — the sexy move" },
  sections: [
    {
      id: "before-you-start",
      title: "Before you start",
      eyebrow: "Basics",
      blocks: [
        { kind: "p", text: "A 3×3 has three kinds of pieces, and they never change type: **centres** (6, one colour — they never move relative to each other, so the centre defines the colour of that side), **edges** (12, two colours) and **corners** (8, three colours). A sticker never leaves its piece: to move a green-white sticker pair you move the whole green-white edge." },
        { kind: "callout", tone: "tip", title: "Centres decide everything", text: ["White is always opposite yellow, green opposite blue, red opposite orange. When a guide says \"the green face\", it means the face whose centre is green — wherever that currently is."] },
        { kind: "p", text: "Solving is therefore never about stickers — it's about putting 20 pieces (12 edges + 8 corners) between the right centres, the right way round. Every step in the guides does that for a few pieces at a time without disturbing the ones already placed." },
      ],
    },
    {
      id: "holding",
      title: "Holding the cube",
      eyebrow: "Basics",
      blocks: [
        { kind: "p", text: "Hold the cube with your fingertips, not your palms. Thumbs and index fingers do almost all the turning; the other fingers just keep the cube from falling. Loose fingers turn faster than a tight grip." },
        { kind: "p", text: "Pick one orientation and keep it while you learn. The solving guides always assume the same one: **white cross on the bottom, yellow on top, green facing you.** Every move letter below is relative to how you're holding the cube right now, not to a colour." },
        { kind: "callout", tone: "tip", text: ["You'll regrip constantly while solving — that's normal. The goal isn't to hold the cube perfectly still, it's to keep your fingers free enough to turn quickly."] },
      ],
    },
    {
      id: "faces",
      title: "The six face turns",
      eyebrow: "Notation",
      blocks: [
        { kind: "p", text: "Each face has a letter: `U` (Up), `D` (Down), `L` (Left), `R` (Right), `F` (Front), `B` (Back). A letter on its own means: turn that face a quarter turn (90°) **clockwise, as if you were looking straight at that face.**" },
        { kind: "demoGrid", columns: 3, demos: [loop("U", "U — Up"), loop("D", "D — Down"), loop("L", "L — Left"), loop("R", "R — Right"), loop("F", "F — Front"), loop("B", "B — Back")] },
        { kind: "callout", tone: "warning", title: "Clockwise from where?", text: ["\"Clockwise\" is judged looking at the face you're turning. From your point of view `R` and `L` therefore go opposite ways: `R` turns the right face away from you (up at the front), `L` turns the left face towards you. Watch `L` and `R` above side by side."] },
      ],
    },
    {
      id: "prime",
      title: "Prime ( ' ) turns",
      eyebrow: "Notation",
      blocks: [
        { kind: "p", text: "A letter followed by an apostrophe — `R'`, said \"R prime\" — means the same face, a quarter turn **counter-clockwise**. It's the exact undo of the plain letter: `R` then `R'` leaves the cube unchanged." },
        { kind: "demoGrid", columns: 3, demos: [loop("U'"), loop("D'"), loop("L'"), loop("R'"), loop("F'"), loop("B'")] },
      ],
    },
    {
      id: "double",
      title: "Double (2) turns",
      eyebrow: "Notation",
      blocks: [
        { kind: "p", text: "A letter followed by 2 — `R2` — means a half turn (180°). Clockwise or counter-clockwise ends in the same place, so there's no separate \"R2 prime\"." },
        { kind: "p", text: "That's the whole alphabet for the beginner method: a plain letter, a prime, or a 2, for each of the six faces." },
        { kind: "demoGrid", columns: 3, demos: [loop("U2"), loop("D2"), loop("L2"), loop("R2"), loop("F2"), loop("B2")] },
      ],
    },
    {
      id: "slices",
      title: "Slice turns — M, E, S",
      eyebrow: "Beyond the basics",
      blocks: [
        { kind: "p", text: "Three more letters turn the **middle layer** between two opposite faces. `M` sits between L and R and follows L's direction; `E` sits between U and D and follows D; `S` sits between F and B and follows F. They take ' and 2 like any other move." },
        { kind: "p", text: "You'll meet `M` in the last-layer edge algorithms (OLL 28, OLL 57, the H and Z permutations)." },
        { kind: "demoGrid", columns: 3, demos: [loop("M"), loop("E"), loop("S"), loop("M'"), loop("E'"), loop("S'")] },
      ],
    },
    {
      id: "wide",
      title: "Wide turns — r, l, u, d, f, b",
      eyebrow: "Beyond the basics",
      blocks: [
        { kind: "p", text: "A lowercase letter turns **two layers together**: the face and the slice next to it. `r` is R plus the middle layer, in R's direction — the same as `R M'`. Wide turns are what make the OLL 28 / OLL 57 edge algorithms comfortable to perform." },
        { kind: "demoGrid", columns: 3, demos: [loop("r"), loop("l"), loop("u"), loop("r'"), loop("l'"), loop("f")] },
      ],
    },
    {
      id: "rotations",
      title: "Rotating the whole cube — x, y, z",
      eyebrow: "Beyond the basics",
      blocks: [
        { kind: "p", text: "`x`, `y` and `z` turn the **entire cube** in your hands: nothing moves relative to anything else, only your point of view changes. `x` rotates like `R` (around the left–right axis), `y` like `U` (around the up–down axis), `z` like `F` (around the front–back axis)." },
        { kind: "p", text: "Algorithms use them when it's easier to re-aim the cube than to keep using awkward face letters. In this app's solving guides you'll mostly see `y` — \"turn the cube so the next slot is in front of you\"." },
        { kind: "demoGrid", columns: 3, demos: [loop("x"), loop("y"), loop("z"), loop("x'"), loop("y'"), loop("z'")] },
      ],
    },
    {
      id: "triggers",
      title: "Triggers",
      eyebrow: "Building blocks",
      blocks: [
        { kind: "p", text: "A trigger is a short move combination that your hands learn as one unit. Most algorithms are just a few triggers glued together — once you know these, a 10-move algorithm reads as \"sexy move, sledgehammer\" instead of ten separate letters." },
        { kind: "p", text: "Each one below is a 3-cycle: it moves three pieces around and leaves the rest alone, so repeating it 6 times brings the cube back to where it started — press play and watch it happen." },
        {
          kind: "cases",
          cases: [
            trigger("sexy", "Sexy move", "R U R' U'", "The single most common four moves in cubing — it's inside dozens of algorithms. The whole beginner last layer in this app is built from it.", "Right hand: index finger flicks U and U', thumb/fingers do R and R'."),
            trigger("left-sexy", "Left sexy move", "L' U' L U", "The same trigger mirrored onto the left hand, for when the piece you need is on that side. Worth drilling left-handed so you never regrip just to reach a right-side trigger."),
            trigger("reverse-sexy", "Reverse sexy move", "U R U' R'", "Same two faces as the sexy move with the U turns flipped — a distinct trigger, not the sexy move played backwards. It inserts a matched F2L pair, and it's the one-shot fix for a first-layer corner with white facing front."),
            trigger("left-reverse-sexy", "Left reverse sexy move", "U' L' U L", "Mirror of the reverse sexy move — inserts a pair on the left."),
            trigger("sledge", "Sledgehammer", "R' F R F'", "The sexy move's close cousin on the R and F faces. Sexy move followed by sledgehammer is a combination you'll meet again in the last layer."),
            trigger("left-sledge", "Left sledgehammer", "L F' L' F", "The sledgehammer on the left hand."),
            trigger("hedge", "Hedgeslammer", "F R' F' R", "The sledgehammer in reverse — same four moves, opposite order."),
            trigger("left-hedge", "Left hedgeslammer", "F' L F L'", "The hedgeslammer on the left hand."),
          ],
        },
        { kind: "guideLink", guideId: "layer-by-layer", label: "Next: Layer by layer", text: "The cross, the first-layer corners and the second-layer edges." },
      ],
    },
  ],
};
