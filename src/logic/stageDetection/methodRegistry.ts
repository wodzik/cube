/**
 * Given a method name (as stored on a session — see StoredSession.solveMethod
 * in types/solve.ts), which StageDetector actually tracks it. The single
 * place SolvePage/SolveAnalysis go to turn "CFOP"/"Roux"/"LBL" into the
 * detector that knows how to check its stages.
 */

import { cfopStageDetector } from "./cfopStages";
import { rouxStageDetector } from "./rouxStages";
import { lblStageDetector } from "./lblStages";
import type { StageDetector } from "./types";

export const METHOD_DETECTORS: Record<string, StageDetector> = {
  CFOP: cfopStageDetector,
  Roux: rouxStageDetector,
  LBL: lblStageDetector,
};

export function detectorForMethod(method: string): StageDetector {
  return METHOD_DETECTORS[method] ?? cfopStageDetector;
}
