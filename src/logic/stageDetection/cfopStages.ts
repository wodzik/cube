/**
 * CFOP: cross → F2L (four pairs, any order — "f2l-2" = any two done) → OLL →
 * PLL (solved up to the last-layer turn) → AUF — cubecore's CFOP method.
 *
 * Details: the cross's physical face ("D"), and per F2L stage the pair that
 * just went in, as its slot's physical faces ("FR").
 */

import { CFOP } from "@wodzik/cubecore/cfop";
import type { StageDetector } from "./types";

export const cfopStageDetector: StageDetector = {
  method: "CFOP",
  stages: ["cross", "f2l-1", "f2l-2", "f2l-3", "f2l-4", "oll", "pll", "auf"],
  cubecore: CFOP,
  stageId: (id) => id,
  detail(stage, raw, frame) {
    if (stage === "cross") return frame?.face.D;
    return stage.startsWith("f2l-") ? raw : undefined;
  },
};
