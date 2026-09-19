/**
 * Academy — guided lessons with a FIXED curriculum (unlike Training, the
 * algorithms here are not selectable or editable: each lesson teaches a
 * specific set, split into `required` and nice-to-know).
 *
 * FOUR independent TOP-LEVEL lessons, one per guide in the "Learn to
 * solve"/F2L track — each is self-contained (its own steps, its own
 * selection storage), not a shared multi-method curriculum:
 *
 *  - "Two first layers": FIRST_LAYER's corners step, then SECOND_LAYER's
 *    edges step. Mirrors the "Layer by layer" guide's first two steps
 *    (that guide's last-layer step is the separate "Last layer" lesson
 *    below).
 *  - "Last layer" (FOUR_LOOK_LL_CORNERS_FIRST): the four looks, shared by
 *    every first-two-layers method — whichever one got you here, this is
 *    the same last layer. Mirrors "The last layer, corners first" guide.
 *  - "Zeta Slotting": edges first (its own step — NOT the same object as
 *    "Two first layers"'s edges step, since Zeta Slotting's edge step
 *    uses shorter, corner-blind edge inserts (plus the two hedgeslammer
 *    "unoriented" cases), which would misleadingly show a first-layer
 *    corner getting disturbed if reused in the corner-first method), then ZETA_CORNERS (F2L's "Edge
 *    In Slot" cases: insert the corner around an edge that's already
 *    seated). Mirrors the "Zeta Slotting" guide.
 *  - "F2L": the intuitive-F2L curriculum from the "Beginner F2L" guide —
 *    the four basic inserts, then the set-up cases — sourced from the
 *    SAME algorithm data the guide reads via helpers.academyAlg, so guide
 *    and drill can't drift apart.
 *
 * FIRST_LAYER and SECOND_LAYER stay exported as their own (non-top-level)
 * AcademyLesson values purely so their `.steps[0]` can be reused by
 * "Two first layers" below without a duplicate object literal.
 *
 * Alg notation may contain "(...)" trigger grouping — e.g.
 * "F (R U R' U') F'" marks the sexy move. Parentheses are DISPLAY-ONLY:
 * parseDecoratedAlg splits notation into plain tokens for the sequence
 * tracker plus per-token prefix/suffix decorations for
 * MoveSequenceDisplay.
 */

export interface AcademyAlg {
  id: string;
  name: string;
  /** Display notation — may contain "(...)" trigger grouping. */
  alg: string;
  required: boolean;
  description?: string;
}

export interface AcademyStep {
  id: string;
  title: string;
  description: string;
  /**
   * Cube view for this step + its card previews, resolved to a mask by
   * trainerMasks.academyStepMask: "first-layer" = only the first layer's
   * pieces, "f2l" = first two layers (last layer greyed out), "f2l-edges"
   * = the same with every corner greyed out too (Zeta Slotting's edges
   * step — corners aren't placed yet), "oll-corners" = OLL stickers with
   * the LL edges blacked out (orient
   * corners), "oll" = classic OLL stickers, "corners" = full-color LL
   * corners with edges blacked out (permute corners — edge permutation is
   * ignored there), "full" = plain cube.
   */
  view: "first-layer" | "f2l" | "f2l-edges" | "oll-corners" | "oll" | "corners" | "full";
  algs: AcademyAlg[];
}

export interface AcademyLesson {
  id: string;
  title: string;
  description: string;
  steps: AcademyStep[];
}

export interface DecoratedAlg {
  /** Plain move tokens — what the sequence tracker and the cube consume. */
  tokens: string[];
  /** Per-token display decorations (trigger parentheses). */
  decorations: Partial<Record<number, { prefix?: string; suffix?: string }>>;
}

export function parseDecoratedAlg(notation: string): DecoratedAlg {
  const tokens: string[] = [];
  const decorations: DecoratedAlg["decorations"] = {};
  let pendingPrefix = "";
  for (const raw of notation.trim().split(/\s+/).filter(Boolean)) {
    let token = raw;
    while (token.startsWith("(")) {
      pendingPrefix += "(";
      token = token.slice(1);
    }
    let suffix = "";
    while (token.endsWith(")")) {
      suffix = `${suffix})`;
      token = token.slice(0, -1);
    }
    if (!token) continue;
    const index = tokens.length;
    tokens.push(token);
    if (pendingPrefix || suffix) {
      decorations[index] = {
        ...(pendingPrefix ? { prefix: pendingPrefix } : {}),
        ...(suffix ? { suffix } : {}),
      };
    }
    pendingPrefix = "";
  }
  return { tokens, decorations };
}

/**
 * First layer — the four white corners, each dropped in with the sexy move
 * (repeated per where the white sticker points). The cross itself has no
 * algorithm and isn't drilled. Same algorithms as the "Layer by layer"
 * guide's corner cases (data/guides/layer-by-layer.ts).
 */
export const FIRST_LAYER: AcademyLesson = {
  id: "first-layer",
  title: "First layer",
  description: "Drop the four first-layer corners in with the sexy move — one, three, or the reverse trigger, depending on which way the white sticker points.",
  steps: [
    {
      id: "corners",
      title: "Corners",
      description:
        "Corner above its slot at the front-right. White facing right: R U R' — a sexy move without its last U', " +
        "which only turns the top. White facing up: three sexy moves. " +
        "White facing you: the reverse sexy move (or five sexy moves). The drill shows the first layer as the " +
        "BOTTOM layer in yellow — it plays the part of white.",
      view: "first-layer",
      algs: [
        { id: "corner-right", name: "White right", alg: "R U R'", required: true, description: "The corner's white sticker points right. It's a sexy move without its last U' — that turn only moves the top layer, so it isn't needed." },
        { id: "corner-up", name: "White up · ×3", alg: "(R U R' U') (R U R' U') (R U R' U')", required: true, description: "The corner's white sticker points up." },
        { id: "corner-front", name: "White front · reverse", alg: "U R U' R'", required: true, description: "The corner's white sticker points at you. Five sexy moves also work." },
        { id: "corner-left-sexy", name: "Left hand · ×1", alg: "(L' U' L U)", required: false, description: "Same as \"white right\", mirrored: slot at the front-left, white facing left." },
        { id: "corner-left-up", name: "Left hand · ×3", alg: "(L' U' L U) (L' U' L U) (L' U' L U)", required: false, description: "Same as \"white up\", mirrored: slot at the front-left, white facing up." },
        { id: "corner-left-front", name: "Left hand · reverse", alg: "U' L' U L", required: false, description: "Same as \"white front\", mirrored: slot at the front-left, white facing you." },
      ],
    },
  ],
};

/**
 * Second layer — the four middle-layer edges, inserted right or left from
 * the top layer. Same algorithms as the "Layer by layer" guide's
 * second-layer cases.
 */
export const SECOND_LAYER: AcademyLesson = {
  id: "second-layer",
  title: "Second layer",
  description: "Insert the middle-layer edges from the top: line up the front sticker with its centre, then send the edge right or left.",
  steps: [
    {
      id: "edges",
      title: "Edges",
      description:
        "Edge at the top-front with its front sticker matching the front centre. Its top sticker says where it goes: " +
        "right or left. Both sequences are two triggers back to back. The first two layers are the bottom two here.",
      view: "f2l",
      algs: [
        { id: "edge-right", name: "Goes right", alg: "(U R U' R') (U' F' U F)", required: true, description: "Top sticker matches the centre on the right." },
        { id: "edge-left", name: "Goes left", alg: "(U' L' U L) (U F U' F')", required: true, description: "Top sticker matches the centre on the left." },
      ],
    },
  ],
};

/**
 * 4-Look Last Layer, CORNERS FIRST — corners before edges in BOTH phases:
 * orient corners → orient edges (full OLL done) → permute corners →
 * permute edges. The corner-permutation algorithms are literally
 * compositions of the A and B building blocks taught at the end of step 1
 * — that's the whole trick of the method.
 */
export const FOUR_LOOK_LL_CORNERS_FIRST: AcademyLesson = {
  id: "4lll-corners-first",
  title: "Last layer",
  description:
    "Finish the last layer in four looks, corners before edges in both phases: " +
    "orient the corners, orient the edges (OLL done), then permute the corners (with the A/B blocks) " +
    "and permute the edges.",
  steps: [
    {
      id: "co",
      title: "1 · Orient corners",
      description:
        "Get all four last-layer corners showing the top color. Repeat the sexy move inside F … F' " +
        "until the case resolves, or use Sun / Antisun. A and B are building blocks — learn them cold, " +
        "they become the corner permutation in step 3.",
      view: "oll-corners",
      algs: [
        {
          id: "sexy1",
          name: "Single sexy",
          alg: "F (R U R' U') F'",
          required: true,
          description: "One sexy move inside F … F'. As a full OLL this is case 45.",
        },
        {
          id: "sexy2",
          name: "Double sexy",
          alg: "F (R U R' U') (R U R' U') F'",
          required: true,
          description: "Two sexy moves inside F … F'. As a full OLL this is case 48.",
        },
        {
          id: "sexy3",
          name: "Triple sexy",
          alg: "F (R U R' U') (R U R' U') (R U R' U') F'",
          required: true,
          description: "Three sexy moves inside F … F'. As a full OLL this is case 21.",
        },
        { id: "sun", name: "Sun", alg: "R U R' U R U2 R'", required: true, description: "The Sune (OLL 27)." },
        { id: "antisun", name: "Antisun", alg: "R U2 R' U' R U' R'", required: true, description: "The Anti-Sune (OLL 26)." },
        {
          id: "block-a",
          name: "A (OLL 33)",
          alg: "(R U R' U') (R' F R F')",
          required: true,
          description: "Algorithm A: a sexy move followed by a sledgehammer. Remember it — you'll use it again later.",
        },
        {
          id: "block-b",
          name: "B (OLL 37)",
          alg: "F R U' R' U' R U R' F'",
          required: true,
          description: "Algorithm B. Remember it — you'll use it again later.",
        },
      ],
    },
    {
      id: "eo",
      title: "2 · Orient edges",
      description:
        "Corners are done, so this is a normal OLL view — only the edges can still be flipped. " +
        "OLL 28 handles two adjacent flipped edges, OLL 57 two opposite ones; for all four flipped, " +
        "apply either one and finish with the other case.",
      view: "oll",
      algs: [
        { id: "oll28", name: "OLL 28", alg: "r U R' U' M U R U' R'", required: true },
        { id: "oll57", name: "OLL 57", alg: "R U R' U' M' U R U' r'", required: true },
        {
          id: "oll20",
          name: "OLL 20",
          alg: "r U R' U' M2 U R U' R' U' M'",
          required: false,
          description: "All four edges flipped — one algorithm instead of chaining OLL 28 into OLL 57.",
        },
      ],
    },
    {
      id: "cp",
      title: "3 · Permute corners",
      description:
        "Two algorithms, and you already know both halves: they are just A and B chained. " +
        "In A + B the middle F' F cancels and R R merges into R2 — that's the sequence shown.",
      view: "corners",
      algs: [
        {
          id: "a-plus-b",
          name: "A + B",
          alg: "(R U R' U') R' F R2 U' R' U' R U R' F'",
          required: true,
          description:
            "A then B — swaps two adjacent corners (this is the T permutation). The F' F in the middle " +
            "cancels and R R merges into R2, which is the sequence shown.",
        },
        {
          id: "b-plus-a",
          name: "B + A",
          alg: "F R U' R' U' R U R' F' (R U R' U') (R' F R F')",
          required: true,
          description: "B then A — swaps two diagonal corners (this is the Y permutation). No cancellation.",
        },
      ],
    },
    {
      id: "epll",
      title: "4 · Permute edges (EPLL)",
      description:
        "The last look: cycle the edges home. Ua and Ub cover every 3-cycle; H and Z are the two " +
        "rarer swap cases — nice to know, or solve them with two U-perms.",
      view: "full",
      algs: [
        { id: "ua", name: "Ua", alg: "R U' R U R U R U' R' U' R2", required: true },
        { id: "ub", name: "Ub", alg: "R2 U R U R' U' R' U' R' U R'", required: true },
        { id: "h", name: "H", alg: "M2 U M2 U2 M2 U M2", required: false },
        { id: "z", name: "Z", alg: "M' U M2 U M2 U M' U2 M2 U'", required: false },
      ],
    },
  ],
};

/**
 * Zeta Slotting's corner step — F2L's "Edge In Slot" cases: the edge
 * already sits correctly in the slot (placed by SECOND_LAYER's step
 * first), and the corner drops in from the top layer around it without
 * disturbing it. Three cases, by which way the corner's white sticker
 * points while it waits directly above the slot (up / front / right) —
 * same recognition shape as FIRST_LAYER's corners step, different
 * algorithms because the edge is in the way this time. Verified against
 * the engine in academy.test.ts and data/guides/guides.test.ts.
 */
const ZETA_CORNERS_STEP: AcademyStep = {
  id: "zeta-corners",
  title: "Corners",
  description:
    "Corner above its slot at the front-right, edge already correctly seated below it. White facing up: " +
    "the sexy move ×3, exactly as in the first layer. White facing front or right: one longer algorithm each — the edge staying put is what " +
    "makes them longer than plain first-layer inserts.",
  view: "f2l",
  algs: [
    { id: "up", name: "White up · ×3", alg: "(R U R' U') (R U R' U') (R U R' U')", required: true, description: "The corner's white sticker points up. The same algorithm as the first-layer corner with white up in the basic method. F2L 32." },
    { id: "front", name: "White front", alg: "U' R U' R' U2 R U' R'", required: true, description: "The corner's white sticker points at you. F2L 33." },
    { id: "right", name: "White right", alg: "U R U R' U2 R U R'", required: true, description: "The corner's white sticker points right. F2L 34." },
    { id: "left-up", name: "Left hand · white up", alg: "(L' U' L U) (L' U' L U) (L' U' L U)", required: false, description: "Same as \"white up\", mirrored: slot at the front-left." },
    { id: "left-front", name: "Left hand · white front", alg: "U L' U L U2 L' U L", required: false, description: "Mirror of \"white front\": slot at the front-left, the corner's white sticker points at you." },
    { id: "left-left", name: "Left hand · white left", alg: "U' L' U' L U2 L' U' L", required: false, description: "Mirror of \"white right\": slot at the front-left, the corner's white sticker points left." },
  ],
};

/**
 * Zeta Slotting's OWN edges step — NOT the same object as SECOND_LAYER's:
 * with no corner to protect, an edge goes in with a much shorter algorithm
 * than the corner-first method's second-layer step. Every alg here
 * disturbs a first-layer corner in passing, which would look like a broken
 * first layer under "Two first layers" (where corners are already solved
 * by this point). Sharing storage/attempts with that lesson would also be
 * wrong now that the case sets differ.
 *
 * "Oriented" = the edge's top sticker is the front (or back) centre's
 * colour: it can always be inserted with L, U and R alone. "Unoriented"
 * = the top sticker matches a side centre and the front sticker matches
 * the front centre: it needs F (the hedgeslammer).
 */
const ZETA_EDGES_STEP: AcademyStep = {
  id: "zeta-edges",
  title: "Edges",
  description:
    "Edge above the front face. If its top sticker matches the front centre (oriented), its front sticker matches " +
    "the centre on the right or left, and a three-move insert sends it that way. If instead its front sticker " +
    "matches the front centre (unoriented), the hedgeslammer inserts it directly.",
  // Corners aren't placed yet in this method — grey them all out so a
  // first-layer corner never reads as "should be solved" (see trainerMasks).
  view: "f2l-edges",
  algs: [
    { id: "edge-right", name: "Oriented · goes right", alg: "R U' R'", required: true, description: "Top sticker matches the front centre, front sticker matches the centre on the right." },
    { id: "edge-left", name: "Oriented · goes left", alg: "L' U L", required: true, description: "Top sticker matches the front centre, front sticker matches the centre on the left." },
    { id: "edge-unoriented-right", name: "Unoriented · goes right", alg: "F R' F' R", required: true, description: "Front sticker matches the front centre, top sticker matches the centre on the right. The hedgeslammer." },
    { id: "edge-unoriented-left", name: "Unoriented · goes left", alg: "F' L F L'", required: false, description: "Front sticker matches the front centre, top sticker matches the centre on the left. The left hedgeslammer." },
  ],
};

export const TWO_FIRST_LAYERS: AcademyLesson = {
  id: "two-first-layers",
  title: "Two first layers",
  description:
    "Layer by layer's first two steps: corners into the first layer with the sexy move, then edges into the " +
    "second. See the \"Layer by layer\" guide.",
  steps: [FIRST_LAYER.steps[0], SECOND_LAYER.steps[0]],
};

export const ZETA_SLOTTING: AcademyLesson = {
  id: "zeta-slotting",
  title: "Zeta Slotting",
  description:
    "Edges into the first two layers before any corners, then a small set of F2L algorithms drops each corner in " +
    "around its already-seated edge. See the \"Zeta Slotting\" guide.",
  steps: [ZETA_EDGES_STEP, ZETA_CORNERS_STEP],
};

/**
 * F2L — the intuitive curriculum from the "Beginner F2L" guide: two basic
 * inserts (plus their left-hand mirrors) and the set-up cases that reduce
 * to one of those two. Algorithm text is the single source of truth for
 * that guide too (see helpers.f2lAlg) — this is NOT the full 41-case F2L
 * reference set (that lives in the Drill Algorithms tab); it's the small
 * set this app actually teaches as "enough to solve every case".
 */
export const F2L_METHOD: AcademyLesson = {
  id: "f2l",
  title: "F2L",
  description:
    "Intuitive F2L: solve the first two layers in corner-edge pairs instead of one piece at a time. See the " +
    "\"Beginner F2L\" guide for the full reasoning behind each case.",
  steps: [
    {
      id: "inserts",
      title: "Basic inserts",
      description:
        "A pair sitting in the top layer is either matched (joined, colours lined up) or split (corner above its " +
        "slot, edge across the top). One insert for each shape, plus its left-hand mirror.",
      view: "f2l",
      algs: [
        { id: "matched-right", name: "Matched", alg: "U R U' R'", required: true, description: "Reverse sexy move — corner's white sticker faces you, edge joined to its right." },
        { id: "split-right", name: "Split", alg: "R U R'", required: true, description: "Corner above its slot, white facing right; edge across the top, green facing up." },
        { id: "matched-left", name: "Matched · left hand", alg: "U' L' U L", required: false, description: "Mirror of the matched insert." },
        { id: "split-left", name: "Split · left hand", alg: "L' U' L", required: false, description: "Mirror of the split insert." },
      ],
    },
    {
      id: "setup",
      title: "Setting up the pair",
      description:
        "Most pairs aren't ready to insert. Each of these is a couple of set-up moves followed by exactly one of " +
        "the two basic inserts above.",
      view: "f2l",
      algs: [
        { id: "corner-in-slot-right", name: "Corner in slot · white right", alg: "R U R' U' R U R'", required: true, description: "Pulls the corner out, then the split insert." },
        { id: "corner-in-slot-front", name: "Corner in slot · white front", alg: "R U' R' U R U' R'", required: true, description: "Pulls the corner out into a matched pair, then the matched insert." },
        { id: "edge-in-slot", name: "Edge in slot", alg: "U' R U' R' U2 R U' R'", required: true, description: "Brings the edge out into a matched pair, then the matched insert." },
        { id: "both-in-slot", name: "Both in slot, corner twisted", alg: "R U' R' U R U2 R' U R U' R'", required: true, description: "Takes the pair out, joins them, then the matched insert." },
        { id: "apart-white-front", name: "Apart · white front", alg: "U' R U R' U2 R U' R'", required: true, description: "Joins the pair into a matched shape, then the matched insert." },
        { id: "apart-white-right", name: "Apart · white right", alg: "U' R U R' U R U R'", required: true, description: "Joins the pair, then the split insert." },
        { id: "joined-wrong", name: "Joined, wrong colours", alg: "U' R U' R' U R U R'", required: true, description: "Re-joins the pair properly, then the split insert." },
        { id: "white-up-edge-right", name: "White up · edge right", alg: "R U2 R' U' R U R'", required: true, description: "Turns the corner so white faces the side, then the split insert." },
        { id: "white-up-edge-left", name: "White up · edge left", alg: "U2 R U R' U R U' R'", required: true, description: "Joins the pair into a matched shape, then the matched insert." },
      ],
    },
  ],
};

export const ACADEMY_LESSONS: AcademyLesson[] = [TWO_FIRST_LAYERS, FOUR_LOOK_LL_CORNERS_FIRST, ZETA_SLOTTING, F2L_METHOD];
