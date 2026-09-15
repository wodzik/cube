/**
 * Cube sticker colors for the timing bar — the same scheme the 3D player
 * (cubing.js's default) paints the cube with, so a stage's segment matches
 * the pieces it was about: the cross in the cross face's color, each F2L
 * slot split into its two side-face colors, the last layer in the color
 * opposite the cross (white cross -> the bar ends yellow).
 *
 * Which face a stage was solved on comes from StageBoundary.detail as
 * recorded by cfopStages / lblStages ("U" for the cross, "RF"-style side
 * faces for a slot); records from before those details existed, and
 * methods that don't record them (Roux), get no cube colors and fall back
 * to the fixed group palette in stageGroups.ts.
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
  const cross = crossFaceOf(timings);
  if (!cross) return null;
  const { stage, detail } = timing;
  if (stage === "cross") return [FACE_COLORS[cross]];
  if (/^(f2l|first-layer|second-layer)-\d$/.test(stage)) {
    const faces = (detail ?? "").split("").filter(isFace);
    return faces.length > 0 ? faces.map((f) => FACE_COLORS[f]) : null;
  }
  const last = FACE_COLORS[OPPOSITE_FACE[cross]];
  if (stage.startsWith("oll")) return [last];
  if (stage.startsWith("pll")) return [darken(last, 0.78)];
  if (stage === "auf") return [darken(last, 0.58)];
  return null;
}
