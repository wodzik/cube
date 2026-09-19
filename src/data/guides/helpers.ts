import { invertSequence } from "../../logic/moveParser";
import { FOUR_LOOK_LL_CORNERS_FIRST, type AcademyLesson } from "../academy";
import type { GuideMaskKind } from "../../logic/guideMasks";
import type { GuideCase, GuideDemo } from "./types";

/**
 * A solving-guide case whose demo scene is "z2 + inverse of alg" unless a
 * hand-built `setup` is given. "Try this" (VariantTest) always presets the
 * physical cube to the inverse of the alg, so it's only offered for the
 * default scenes — a hand-built scene would show the popup a different
 * situation than the card.
 */
export function solveCase(
  id: string,
  name: string,
  recognise: string,
  hold: string | undefined,
  alg: string,
  mask: GuideMaskKind,
  extra: Partial<GuideCase> & { view?: "top" | "bottom"; setup?: string } = {}
): GuideCase {
  const { view, setup, ...rest } = extra;
  return {
    id,
    name,
    recognise,
    hold,
    alg,
    demo: { setup: setup ?? guideSetup(alg), alg: algTokens(alg).join(" "), mask, view, tryOnCube: setup === undefined },
    ...rest,
  };
}

/** Plain move tokens of a display notation — trigger parentheses stripped. */
export function algTokens(alg: string): string[] {
  return alg.replace(/[()]/g, " ").trim().split(/\s+/).filter(Boolean);
}

/**
 * "z2, then the inverse of `alg`" — the standard guide scene: white cross on
 * the bottom, and playing `alg` from here ends on a solved cube. The
 * inverse is built with the app's own invertSequence (not cubing.js's Alg
 * .invert(), which spells U2 as U2').
 */
export function guideSetup(alg: string): string {
  return ["z2", ...invertSequence(algTokens(alg))].join(" ");
}

/**
 * The index-card animation for a guide: one of its own cases, looping — the
 * case's scene (z2 + inverse of `alg`) and sticker mask, `alg` played once
 * and the solved result held until the loop restarts. guides.test.ts checks
 * that a preview really is one of the guide's case demos.
 */
export function previewOf(alg: string, mask: GuideMaskKind): GuideDemo {
  return { setup: guideSetup(alg), alg: algTokens(alg).join(" "), mask, loop: true, repeat: 1 };
}

/** Solved cube, white on the bottom — for checkpoint pictures. */
export const SOLVED_SETUP = "z2";

/** `alg` repeated n times, as one notation string. */
export function repeatAlg(alg: string, n: number): string {
  return Array(n).fill(alg).join(" ");
}

/**
 * An Academy lesson's algorithm text, by step and alg id — single source of
 * truth shared between a guide and its matching drill (defaults to the
 * 4-Look Last Layer lesson, used by both the last-layer and Zeta Slotting
 * guides; pass ZETA_SLOTTING/F2L_METHOD/SECOND_LAYER etc. for the others).
 */
export function academyAlg(stepId: string, algId: string, lesson: AcademyLesson = FOUR_LOOK_LL_CORNERS_FIRST): string {
  const step = lesson.steps.find((s) => s.id === stepId);
  const alg = step?.algs.find((a) => a.id === algId);
  if (!alg) throw new Error(`academy alg not found: ${lesson.id}/${stepId}/${algId}`);
  return alg.alg;
}
