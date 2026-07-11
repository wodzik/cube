/**
 * DORMANT — unused. `record.method` now comes straight from the session's
 * configured StoredSession.solveMethod (a user setting, see
 * types/solve.ts), not from this. Kept as a starting point for real
 * auto-detection later (e.g. comparing which method's stages complete
 * earliest/most cleanly against the same move stream — see
 * logic/stageDetection/methodResolvers.ts's doc comment for the fuller
 * plan, including a "detected X, session says Y — switch?" suggestion).
 * Each method's actual per-stage detection lives in its own StageDetector
 * (cfopStageDetector, rouxStageDetector, lblStageDetector) — this function
 * only ever picked which one is "the" method label; all three are always
 * tracked and stored regardless (see types/solve.ts SolveRecord.cfop /
 * .roux / .lbl).
 */

import type { SolveMethod } from "../../types/solve";

export function detectMethod(): SolveMethod {
  return "CFOP";
}
