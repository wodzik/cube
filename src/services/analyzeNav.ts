/**
 * Opening the Analyze tab with a scramble (and the solve it came from) —
 * from anywhere (a solve's analysis, history…). App listens and switches.
 */

export interface AnalyzeRequest {
  scramble: string;
  /** The solve to compare with, if any. */
  solve?: { moves: string[]; timeMs?: number; moveCount?: number; method?: string };
}

const EVENT = "act-open-analyze";

export function openAnalyze(request: AnalyzeRequest): void {
  window.dispatchEvent(new CustomEvent<AnalyzeRequest>(EVENT, { detail: request }));
}

export function onOpenAnalyze(fn: (r: AnalyzeRequest) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<AnalyzeRequest>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}
