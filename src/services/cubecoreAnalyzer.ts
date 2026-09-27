import { createAnalyzerWorker, type AnalyzerClient } from "@wodzik/cubecore/analyze";

let client: AnalyzerClient | null = null;
/** The scramble analyser (cubecore, in a worker — its tables build once per device, then come from IndexedDB). */
export function cubecoreAnalyzer(): AnalyzerClient {
  client ??= createAnalyzerWorker();
  return client;
}
