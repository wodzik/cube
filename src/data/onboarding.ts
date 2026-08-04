/**
 * Academy onboarding — a swipeable slide deck for complete beginners,
 * shown automatically the first time Academy is opened (see AcademyPage's
 * localStorage flag) and re-openable afterward via a header button.
 *
 * Organized as CHAPTERS of SLIDES rather than one flat list, so the
 * carousel can show "Chapter 2 of 6" progress and the content stays easy
 * to extend later without renumbering everything.
 *
 * PLACEHOLDER CONTENT: chapters "cross", "first-layer-corners",
 * "second-layer-edges", and "last-layer" are intentionally thin stubs —
 * see each chapter's own comment. Fill these in before shipping; the
 * carousel/data plumbing itself is complete and not a placeholder.
 */

export interface OnboardingDemo {
  /** Applied to the cube BEFORE `alg`, literally (not inverted) — e.g. a scramble to set the scene. */
  setupAlg?: string;
  /** The move sequence the slide is actually about. */
  alg: string;
  /** Repeat `alg` this many times back-to-back (e.g. the sexy move returns to solved after 6 reps) — purely a playback convenience, not tracked/validated. */
  repeat?: number;
  /** Short caption shown under this demo — only used inside a `demos` grid (see OnboardingSlide.demos), where several demos need telling apart. */
  label?: string;
}

export interface OnboardingSlide {
  id: string;
  title: string;
  /** Short paragraphs, rendered one per line. Keep each one skimmable. */
  paragraphs: string[];
  /** Single centered demo cube, paused and ready for the user to press play (has playback controls). */
  demo?: OnboardingDemo;
  /** Show a "Try this" button under `demo` that opens the same physical-cube practice popup as CaseEdit's variant test (connect BT cube, moves tracked live against `demo.alg`). Requires `demo`. */
  tryOnCube?: boolean;
  /**
   * A grid of several small cube players, each auto-playing its own `alg`
   * on a loop with no controls — e.g. one per face move, side by side, so
   * a whole family of moves (U/D/L/R/F/B, the primes, M/E/S, x/y/z...) can
   * be seen at once instead of one at a time. Mutually exclusive with `demo`.
   */
  demos?: OnboardingDemo[];
}

export interface OnboardingChapter {
  id: string;
  title: string;
  slides: OnboardingSlide[];
}

export const ONBOARDING_CHAPTERS: OnboardingChapter[] = [
  {
    id: "basic-triggers",
    title: "Basic triggers",
    slides: [
      {
        id: "sexy-move",
        title: "The \"sexy move\" — R U R' U'",
        paragraphs: [
          "R U R' U' is the single most common 4-move sequence in cubing — it shows up inside dozens of longer algorithms, not just on its own.",
          "It's a 3-cycle: it moves three pieces around without otherwise disturbing the cube (up to the U-layer setup you did to line it up).",
          "Fun fact: repeat it 6 times in a row and the cube returns EXACTLY to where it started — press play below and watch it happen.",
        ],
        demo: { alg: "R U R' U'", repeat: 6 },
        tryOnCube: true,
      },
      {
        id: "left-sexy-move",
        title: "The \"left sexy move\" — L' U' L U",
        paragraphs: [
          "The left-hand version of the sexy move — same trigger, mirrored onto the left side, for when the piece you need sits over there instead.",
          "Worth drilling with your left hand specifically: two-handed solving means never re-gripping just to reach a right-side-only trigger.",
        ],
        demo: { alg: "L' U' L U", repeat: 6 },
        tryOnCube: true,
      },
      {
        id: "sledgehammer",
        title: "The \"sledgehammer\" (sledge) — R' F R F'",
        paragraphs: [
          "R' F R F' is the sexy move's close cousin, used just as often — same idea, different pair of faces.",
          "Like the sexy move, it's a 3-cycle, and it also returns to solved if you repeat it enough times.",
        ],
        demo: { alg: "R' F R F'", repeat: 6 },
        tryOnCube: true,
      },
      {
        id: "left-sledgehammer",
        title: "The \"left sledgehammer\" (left sledge) — L F' L' F",
        paragraphs: [
          "The left-hand version of the sledgehammer — same trigger, mirrored onto the left side of the cube, for when the piece you need sits over there instead.",
          "Worth drilling with your left hand specifically: two-handed solving means never re-gripping just to reach a right-side-only trigger.",
        ],
        demo: { alg: "L F' L' F", repeat: 6 },
        tryOnCube: true,
      },
      {
        id: "hedgeslammer",
        title: "The \"hedgeslammer\" (hedge) — F R' F' R",
        paragraphs: [
          "F R' F' R is the sledgehammer's mirror — same four moves, opposite handedness, so it 3-cycles pieces the other way around.",
          "Between the sexy move, the sledgehammer, and the hedgeslammer, you already recognize the building blocks inside most beginner-friendly algorithms.",
        ],
        demo: { alg: "F R' F' R", repeat: 6 },
        tryOnCube: true,
      },
      {
        id: "left-hedgeslammer",
        title: "The \"left hedgeslammer\" (left hedge) — F' L F L'",
        paragraphs: [
          "The left-hand version of the hedgeslammer, same idea as left sledge — mirrored onto the left side.",
          "With both left and right versions of sledge and hedge down, you can reach for whichever side the piece is actually on instead of rotating the cube to force a right-hand trigger.",
        ],
        demo: { alg: "F' L F L'", repeat: 6 },
        tryOnCube: true,
      },
      {
        id: "reverse-sexy-move",
        title: "The \"reverse sexy move\" — R U' R' U",
        paragraphs: [
          "Same two faces as the sexy move, but with the U turns flipped — a distinct trigger in its own right, not just the sexy move played backward.",
          "Handy when the sexy move would disturb a piece you already placed — this one cycles pieces the other way around the same two faces.",
        ],
        demo: { alg: "R U' R' U", repeat: 6 },
        tryOnCube: true,
      },
      {
        id: "left-reverse-sexy-move",
        title: "The \"left reverse sexy move\" — L' U L U'",
        paragraphs: [
          "The left-hand version of the reverse sexy move, mirrored onto the left side — same relationship as sexy/left-sexy.",
          "That's the basic trigger set: sexy move, sledgehammer, and reverse sexy move, each with its left-hand mirror. Everything else in this guide builds on these.",
        ],
        demo: { alg: "L' U L U'", repeat: 6 },
        tryOnCube: true,
      },
    ],
  },
  {
    id: "holding-and-notation",
    title: "Holding the cube & notation",
    slides: [
      {
        id: "how-to-hold",
        title: "How to hold your cube",
        paragraphs: [
          "Hold the cube with your fingertips, not your palms — thumbs and index/middle fingers do almost all the work, the other fingers just support the cube underneath.",
          "Pick one orientation and stick with it while you're learning: white on top, green facing you is the classic starting grip used throughout this app.",
          "You'll regrip constantly while solving — that's normal. The goal isn't to hold it perfectly still, it's to keep your fingers loose enough to turn quickly.",
        ],
      },
      {
        id: "the-six-faces",
        title: "The six face moves",
        paragraphs: [
          "Every move is just the letter of the face it turns, as seen from the outside — a shorthand for the face's name, nothing more:",
          "U (Up), D (Down), L (Left), R (Right), F (Front), B (Back).",
          "A letter on its own means: turn that face 90°, clockwise — like a clock's hands — as you look directly at it. Watch all six below.",
        ],
        demos: [
          { alg: "U", label: "U — Up", repeat: 60 },
          { alg: "D", label: "D — Down", repeat: 60 },
          { alg: "L", label: "L — Left", repeat: 60 },
          { alg: "R", label: "R — Right", repeat: 60 },
          { alg: "F", label: "F — Front", repeat: 60 },
          { alg: "B", label: "B — Back", repeat: 60 },
        ],
      },
      {
        id: "prime-turns",
        title: "Prime ( ' ) turns",
        paragraphs: [
          "A letter followed by an apostrophe, like R', means turn that same face 90° COUNTERclockwise instead — the exact reverse of the plain letter.",
          "Every face has its own prime: U', D', L', R', F', B'. Watch each one and compare it to the plain move on the previous page.",
        ],
        demos: [
          { alg: "U'", label: "U'", repeat: 60 },
          { alg: "D'", label: "D'", repeat: 60 },
          { alg: "L'", label: "L'", repeat: 60 },
          { alg: "R'", label: "R'", repeat: 60 },
          { alg: "F'", label: "F'", repeat: 60 },
          { alg: "B'", label: "B'", repeat: 60 },
        ],
      },
      {
        id: "double-turns",
        title: "Double (2) turns",
        paragraphs: [
          "A letter followed by 2, like R2, means turn that face 180° — a half turn. Clockwise or counterclockwise gets you to the same place, so there's no separate '2 prime'.",
          "That's the whole alphabet: a plain letter, a prime, or a 2, for each of the six faces — every single move you'll see in this app is built from these. Watch all six below.",
        ],
        demos: [
          { alg: "U2", label: "U2", repeat: 60 },
          { alg: "D2", label: "D2", repeat: 60 },
          { alg: "L2", label: "L2", repeat: 60 },
          { alg: "R2", label: "R2", repeat: 60 },
          { alg: "F2", label: "F2", repeat: 60 },
          { alg: "B2", label: "B2", repeat: 60 },
        ],
      },
      {
        id: "middle-layer-moves",
        title: "Middle layer moves — M, E, S",
        paragraphs: [
          "Three more letters turn the LAYER BETWEEN two opposite faces, instead of an outer face — useful once you get past absolute beginner methods.",
          "M (Middle) sits between L and R, and turns the same direction as L. E (Equator) sits between U and D, and turns the same direction as D. S (Standing) sits between F and B, and turns the same direction as F.",
          "They take ' and 2 exactly like any other move: M', E2, and so on — here are the plain and prime versions of each.",
        ],
        demos: [
          { alg: "M", label: "M", repeat: 60 },
          { alg: "E", label: "E", repeat: 60 },
          { alg: "S", label: "S", repeat: 60 },
          { alg: "M'", label: "M'", repeat: 60 },
          { alg: "E'", label: "E'", repeat: 60 },
          { alg: "S'", label: "S'", repeat: 60 },
        ],
      },
      {
        id: "cube-rotations",
        title: "Rotating the whole cube — x, y, z",
        paragraphs: [
          "x, y, and z rotate the ENTIRE cube in your hands — no pieces move relative to each other, only your point of view changes.",
          "x rotates like R (around the L/R axis), y rotates like U (around the U/D axis), z rotates like F (around the F/B axis). Each has a prime too, same as any other move.",
          "You'll see these in algorithm notation when it's more convenient to re-aim the cube than to keep using awkward face letters.",
        ],
        demos: [
          { alg: "x", label: "x", repeat: 60 },
          { alg: "y", label: "y", repeat: 60 },
          { alg: "z", label: "z", repeat: 60 },
          { alg: "x'", label: "x'", repeat: 60 },
          { alg: "y'", label: "y'", repeat: 60 },
          { alg: "z'", label: "z'", repeat: 60 },
        ],
      },
    ],
  },
  {
    // PLACEHOLDER CHAPTER — cross has no fixed algorithm (it's intuitive,
    // solved case-by-case), so this should walk through a couple of the
    // most common edge-to-cross situations as short EXAMPLE move sequences
    // (not "the" algorithm) with plain-language reasoning, not just moves.
    // Replace with real content before shipping.
    id: "cross",
    title: "The cross",
    slides: [
      {
        id: "cross-intro",
        title: "Building the white cross",
        paragraphs: [
          "[Placeholder] The cross is the only step in this guide that isn't a memorized algorithm — you work it out intuitively, piece by piece.",
          "[Placeholder] Goal: get all four white edges onto the D face (opposite white's usual U-face home during solving prep... TODO reconcile with this app's own U/D convention), matching their side colors to the centers.",
          "[Placeholder — replace with 2-3 concrete worked examples, e.g. 'edge in the top layer, wrong spot' and 'edge in the middle layer', each with its own short move example.]",
        ],
        demo: { alg: "F2" },
      },
    ],
  },
  {
    // PLACEHOLDER CHAPTER — first-layer corners (the 4 white corners),
    // typically taught as "the corner is either in the top layer or
    // already in the bottom layer twisted wrong" with a single repeatable
    // trigger (often the sexy move or R' D' R D) to cycle it into place.
    id: "first-layer-corners",
    title: "First-layer corners",
    slides: [
      {
        id: "corners-intro",
        title: "Placing the first-layer corners",
        paragraphs: [
          "[Placeholder] With the cross done, next come the four corners that complete the first layer.",
          "[Placeholder — replace with the actual beginner approach this app wants to teach: line the corner up under its slot, then repeat a single trigger (e.g. R' D' R D) until it pops in.]",
        ],
        demo: { alg: "R' D' R D" },
      },
    ],
  },
  {
    // PLACEHOLDER CHAPTER — second-layer (F2L-ish, but beginner-style:
    // edge-only insertion, not full F2L pairing) — the two standard
    // "insert edge to the left / to the right" triggers.
    id: "second-layer-edges",
    title: "Second-layer edges",
    slides: [
      {
        id: "second-layer-intro",
        title: "Inserting second-layer edges",
        paragraphs: [
          "[Placeholder] Two triggers cover every second-layer edge: one inserts it to the left, the other to the right of a top-layer corner.",
          "[Placeholder — add both triggers with demos once decided, e.g. U R U' R' U' F' U F for right-insert.]",
        ],
        demo: { alg: "U R U' R' U' F' U F" },
      },
    ],
  },
  {
    // PLACEHOLDER CHAPTER — last layer: point at the 4 sub-steps that
    // already exist as a full lesson (ACADEMY_LESSONS[0], 4-Look Last
    // Layer, corners first) rather than duplicating that content here.
    // Each slide below should eventually deep-link or at least explicitly
    // name-check the matching step id in data/academy.ts (co / eo / cp /
    // epll) so a reader knows exactly where to go practice it.
    id: "last-layer",
    title: "The last layer, four looks",
    slides: [
      {
        id: "ll-overview",
        title: "Four looks, four short algorithm sets",
        paragraphs: [
          "The last layer is the one part of this guide with a full lesson already built — 4-Look Last Layer, corners first (see the Academy lesson picker).",
          "It breaks down into exactly four looks: orient the corners, orient the edges, permute the corners, permute the edges — each one just a small handful of algorithms to learn.",
          "[Placeholder — the four slides below are stubs; flesh each out with its own short explanation, matching the corresponding step in the 4-Look Last Layer lesson (co / eo / cp / epll).]",
        ],
      },
      {
        id: "ll-orient-corners",
        title: "1 · Orient the corners",
        paragraphs: ["[Placeholder] Get all four last-layer corners showing the top color — see the 'Orient corners' step."],
        demo: { alg: "F R U R' U' F'" },
      },
      {
        id: "sune",
        title: "Sune — R U R' U R U2 R'",
        paragraphs: [
          "Sune is one of the very first full algorithms most solvers memorize — it orients three last-layer corners in one shot.",
          "It's OLL 27 if you ever learn full OLL — and its mirror, Anti-Sune, handles the other common 2-corners-need-flipping case.",
        ],
        demo: { alg: "R U R' U R U2 R'" },
      },
      {
        id: "ll-orient-edges",
        title: "2 · Orient the edges",
        paragraphs: ["[Placeholder] With corners done, flip the remaining edges — see the 'Orient edges' step."],
      },
      {
        id: "ll-permute-corners",
        title: "3 · Permute the corners",
        paragraphs: ["[Placeholder] Move the corners into their correct spots — see the 'Permute corners' step."],
      },
      {
        id: "ll-permute-edges",
        title: "4 · Permute the edges",
        paragraphs: ["[Placeholder] Cycle the edges home to finish the cube — see the 'Permute edges (EPLL)' step."],
      },
    ],
  },
];
