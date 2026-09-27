/**
 * cubecore's solver in a worker (stage scrambles, distances, optimal
 * solutions — the trainers' engine). One worker for the whole app, started
 * on first use. Vite bundles the package's worker (new Worker(new URL…)).
 */

import { createSolverWorker, type SolverClient } from "@wodzik/cubecore/solve";

let client: SolverClient | null = null;

export function cubecoreSolver(): SolverClient {
  client ??= createSolverWorker();
  return client;
}
