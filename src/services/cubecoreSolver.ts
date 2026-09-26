/**
 * cubecore's solver in a worker (stage scrambles, distances, optimal
 * solutions — the trainers' engine). One worker for the whole app, started
 * on first use. Vite bundles it from the local cubecore sources (?worker).
 */

import { solverClient, type SolverClient } from "@cubecore/solve";
import SolverWorker from "../../../cubecore/packages/solve/src/worker.ts?worker";

let client: SolverClient | null = null;

export function cubecoreSolver(): SolverClient {
  client ??= solverClient(new SolverWorker());
  return client;
}
