/**
 * Academy — guided lessons with a FIXED curriculum (unlike Training, the
 * algorithms here are not selectable or editable: each lesson teaches a
 * specific set, split into `required` and nice-to-know).
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
   * trainerMasks.academyStepMask: "oll-corners" = OLL stickers with the LL
   * edges blacked out (orient corners), "oll" = classic OLL stickers,
   * "corners" = full-color LL corners with edges blacked out (permute
   * corners — edge permutation is ignored there), "full" = plain cube.
   */
  view: "oll-corners" | "oll" | "corners" | "full";
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
 * 4-Look Last Layer, CORNERS FIRST — corners before edges in BOTH phases:
 * orient corners → orient edges (full OLL done) → permute corners →
 * permute edges. The corner-permutation algorithms are literally
 * compositions of the A and B building blocks taught at the end of step 1
 * — that's the whole trick of the method.
 */
export const FOUR_LOOK_LL_CORNERS_FIRST: AcademyLesson = {
  id: "4lll-corners-first",
  title: "4-Look Last Layer — Corners First",
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
          description:
            "Building block: sexy move + sledgehammer. Combined into A + B / B + A for corner permutation.",
        },
        {
          id: "block-b",
          name: "B (OLL 37)",
          alg: "F R U' R' U' R U R' F'",
          required: true,
          description: "Building block — combined into A + B / B + A for corner permutation.",
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
          alg: "M U (R U R' U') M2 (U R U' r')",
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

export const ACADEMY_LESSONS: AcademyLesson[] = [FOUR_LOOK_LL_CORNERS_FIRST];
