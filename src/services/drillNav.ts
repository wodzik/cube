/**
 * Opening Drill Algorithms on one case (and one of its algorithms) — from a
 * solve's analysis, the case stats… App listens and switches to the tab.
 */

export interface DrillRequest {
  group: string;
  subgroup?: string;
  caseName: string;
  /** Drill this algorithm of the case (else the case's default one). */
  variantId?: string;
}

const EVENT = "act-open-drill";

export function openDrill(request: DrillRequest): void {
  window.dispatchEvent(new CustomEvent<DrillRequest>(EVENT, { detail: request }));
}

export function onOpenDrill(fn: (r: DrillRequest) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<DrillRequest>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}
