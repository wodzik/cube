/**
 * DORMANT — not currently wired into the live app. Which method drives the
 * live progress bar is a per-session SETTING now (StoredSession.solveMethod,
 * see types/solve.ts and SessionEditModal in components/SessionManager.tsx),
 * chosen by the user rather than auto-detected — useMethodProgress takes an
 * explicit StageDetector, not a MethodResolution.
 *
 * This file (and methodResolution.ts's MethodResolution engine) is kept
 * around, unused, as a starting point for two future features the user
 * asked to defer rather than drop:
 *
 * 1. Real automatic detection — swap the live progress bar back to
 *    resolver-driven once real isConfirmed predicates exist for each
 *    method (see below), instead of session settings.
 * 2. A "detected X, but this session is set to Y — switch?" suggestion:
 *    run MethodResolution alongside the session's configured detector,
 *    and prompt if the resolver ends up confirming a DIFFERENT method
 *    than session.solveMethod.
 *
 * Real isConfirmed predicates, sketched (not implemented — cfopResolver
 * below stubs to `true` unconditionally, i.e. always-CFOP if this were
 * ever wired back in):
 *
 * - cfopResolver: confirmed once boundaries contains "f2l-1" WHILE
 *   lblStageDetector's own "first-layer" (all 4 first-layer corners) is
 *   NOT yet reached on the same move stream — a paired corner+edge before
 *   all 4 corners are placed is CFOP-specific; LBL never pairs, it
 *   finishes all 4 first-layer corners with zero second-layer edges done,
 *   then places edges separately. Requires comparing against a second,
 *   parallel lblStageDetector walker (not just the resolver's own
 *   boundaries) to disambiguate the shared "cross" prefix — the current
 *   MethodResolver.isConfirmed signature (boundaries only) doesn't carry
 *   that cross-detector context; extending it is part of implementing this.
 *
 * - lblResolver: confirmed once "first-layer" is reached — LBL's earliest
 *   unambiguous signal, later than CFOP's own (matches the "right after
 *   cross, default to showing CFOP tentatively; switch to LBL only if/when
 *   ITS confirm condition fires first" framing). MethodResolution already
 *   supports this "tentative default, switch on stronger signal" behavior
 *   for free — see its doc comment.
 *
 * - rouxResolver: confirmed once boundaries contains "sb" (second block) —
 *   by then it's unambiguous. An isStillPossible?(boundaries): boolean
 *   extension point (not implemented) could let it be dropped EARLIER,
 *   the moment ANY other resolver's boundaries contain "cross" (Roux's own
 *   first milestone is a first block, never a cross) — though
 *   MethodResolution's existing "drop every other walker the instant one
 *   resolver confirms" already gets most of this for free once CFOP-or-LBL
 *   confirms; isStillPossible would only shave off the narrower window
 *   between "cross exists" and "CFOP or LBL specifically confirms".
 */

import { cfopStageDetector } from "./cfopStages";
import type { StageBoundary, StageDetector } from "./types";

export interface MethodResolver {
  detector: StageDetector;
  /** True once this method is DEFINITELY confirmed — not just still possible. Checked after every move; the first resolver (in registry order) to return true locks in for the rest of the solve. */
  isConfirmed(boundaries: readonly StageBoundary[]): boolean;
}

const cfopResolver: MethodResolver = {
  detector: cfopStageDetector,
  isConfirmed: () => true, // stub — see file doc comment
};

/** Registry order also doubles as tie-break/default priority — see MethodResolution. */
export const METHOD_RESOLVERS: readonly MethodResolver[] = [cfopResolver];
