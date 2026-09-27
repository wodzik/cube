/** Switching to another tab from inside a page (an empty state's "go there" link…). App listens. */

const EVENT = "act-open-tab";

export function openTab(tab: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: tab }));
}

export function onOpenTab(fn: (tab: string) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<string>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}
