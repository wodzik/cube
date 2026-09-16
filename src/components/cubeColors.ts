/**
 * Cube sticker colors for the timing bar — the same scheme the 3D player
 * (cubing.js's default) paints the cube with, so a stage's segment matches
 * the pieces it was about: the cross in the cross face's color, each F2L
 * slot split into its two side-face colors, the last layer in the color
 * opposite the cross (white cross -> the bar ends yellow), and Roux's
 * fb/sb blocks split into their floor + side-wall colors with cmll/lse
 * taking the color opposite the floor.
 *
 * Which face a stage was solved on comes from StageBoundary.detail as
 * recorded by cfopStages / lblStages ("U" for the cross, "RF"-style side
 * faces for a slot) or rouxStages ("DL"-style floor+side for fb/sb, a bare
 * floor letter for cmll/lse); records from before those details existed
 * get no cube colors and fall back to the fixed group palette in
 * stageGroups.ts. PLL is the one exception: it's a permutation, not a
 * piece color, and darkening the last-layer color for it read as "2x
 * yellow" next to OLL — so it gets a fixed accent hue instead, distinct
 * from every real face color.
 */

import type { StageTiming } from "../logic/stageDetection/stageTiming";
import { OPPOSITE_FACE, type Face } from "../logic/stageDetection/lastLayerShared";

/** cubing.js Cube3D defaults: U white, D yellow, F green, B blue, R red, L orange. */
export const FACE_COLORS: Record<Face, string> = {
  U: "#ffffff",
  D: "#ffd500",
  F: "#00d800",
  B: "#0050ff",
  R: "#ff0000",
  L: "#ff8000",
};

/** PLL's dedicated color — not a real sticker color, chosen to read clearly against any last-layer face color. */
const PLL_ACCENT = "#a855f7";

const FACES = new Set<string>(["U", "D", "F", "B", "L", "R"]);

function isFace(s: string): s is Face {
  return FACES.has(s);
}

/** Multiplies each RGB channel — for telling OLL / PLL / AUF apart within the one last-layer color. */
function darken(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 0xff) * factor);
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** The face the cross / first layer was built on, from the solve's own stage details. */
export function crossFaceOf(timings: readonly StageTiming[]): Face | null {
  const d = timings.find((t) => t.stage === "cross")?.detail;
  return d && isFace(d) ? d : null;
}

/**
 * The 1-2 sticker colors a stage segment should show, or null when the
 * solve carries no face details for it (fall back to the group palette).
 */
export function stageCubeColors(timing: StageTiming, timings: readonly StageTiming[]): string[] | null {
  const { stage, detail } = timing;

  // Roux: fb/sb carry their own floor+side detail (no shared "cross" stage
  // to look up), cmll/lse carry just the floor letter.
  if (stage === "fb" || stage === "sb") {
    const faces = (detail ?? "").split("").filter(isFace);
    return faces.length > 0 ? faces.map((f) => FACE_COLORS[f]) : null;
  }
  if (stage === "cmll" || stage === "lse") {
    const floor = detail && isFace(detail) ? detail : null;
    if (!floor) return null;
    const last = FACE_COLORS[OPPOSITE_FACE[floor]];
    return [stage === "cmll" ? last : darken(last, 0.58)];
  }

  const cross = crossFaceOf(timings);
  if (!cross) return null;
  if (stage === "cross") return [FACE_COLORS[cross]];
  if (/^(f2l|first-layer|second-layer)-\d$/.test(stage)) {
    const faces = (detail ?? "").split("").filter(isFace);
    return faces.length > 0 ? faces.map((f) => FACE_COLORS[f]) : null;
  }
  const last = FACE_COLORS[OPPOSITE_FACE[cross]];
  if (stage.startsWith("oll")) return [last];
  if (stage.startsWith("pll")) return [PLL_ACCENT];
  if (stage === "auf") return [darken(last, 0.58)];
  return null;
}
