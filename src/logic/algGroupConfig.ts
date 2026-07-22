/**
 * Shared configuration for algorithm groups (OLL / PLL / F2L).
 * Pure module — no React, no side-effects.
 */

import type { AlgorithmCase, AlgorithmVariant } from "../types/algorithm";

/** Returns the default variant for a case, falling back to the first variant. */
export function getDefaultVariant(case_: AlgorithmCase): AlgorithmVariant | undefined {
  return case_.algList.find((v) => v.isDefault) ?? case_.algList[0];
}
