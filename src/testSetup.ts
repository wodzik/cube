/**
 * Minimal localStorage polyfill for bun:test (Node/Bun test runtime has no
 * DOM). Only what services/*.ts actually use: getItem/setItem/removeItem/clear.
 * Import for side effects in any test that touches localStorage.
 */

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

if (typeof globalThis.localStorage === "undefined") {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
}
