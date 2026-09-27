import { analyzerClient, type AnalyzerClient } from "@cubecore/analyze";
import AnalyzerWorker from "../../../cubecore/packages/analyze/src/worker.ts?worker";

let client: AnalyzerClient | null = null;
/** The scramble analyser (cubecore, in a worker — its tables build once per device, then come from IndexedDB). */
export function cubecoreAnalyzer(): AnalyzerClient {
  client ??= analyzerClient(new AnalyzerWorker());
  return client;
}
