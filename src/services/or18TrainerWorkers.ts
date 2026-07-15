/**
 * Client for the vendored or18 trainer WASM workers
 * (public/trainers/* — GPL-3.0, see public/trainers/README.md; ALL access
 * to them must go through this module so a future clean-room swap stays
 * contained).
 *
 * Every engine exposes one operation, `func(scr, len)`, returning a single
 * comma-separated string. Two response shapes exist:
 *
 *  2-part (xcross, eocross, xxcross):   "<scr><A>,<B>"
 *  4-part (pairing):                    "<scr><A>,<applA>,<B>,<applB>"
 *
 *   A = an optimal solution of `scr` for the engine's NATIVE target
 *       (calibrated per engine, see logic/trainer/*Frames.ts).
 *   B = an optimal solution of a uniformly random state whose exact optimal
 *       depth is `len` — sampled from the engine's own depth-indexed
 *       tables, optimal-by-construction.
 *   applX (pairing only) = the goal state reached by X is "pair formed, one
 *       insert away"; applX is the generator FROM the fully-inserted state
 *       to that goal (an insert alg + optional AUF) — see pairingFrames.ts.
 *
 * `scr` MUST end with a trailing space: the C++ side string-concatenates
 * `scr + A` and would otherwise glue the last scramble token to A's first.
 *
 * Each engine builds large move/prune tables in its worker's memory on
 * first use (xcross ~600 MB / a few seconds; the others are comparable) —
 * workers are created lazily, kept alive for the whole app session, and
 * requests are serialized per worker. XXCross is one worker hosting TWO
 * engine instances (adjacent / opposite slot pair), initialized separately
 * on each pairType's first request.
 */

export type XXCrossPairType = "adj" | "opp";

/** One serialized-request lane per underlying Worker. */
interface WorkerLane {
  workerPromise: Promise<Worker>;
  chain: Promise<unknown>;
  ready: boolean;
}

interface EngineSpec {
  url: string;
  /** Cheap request whose reply signals "tables built". */
  warmup: Record<string, string>;
}

// BASE_URL-prefixed (not root-absolute) so the app also works hosted under
// a subpath (e.g. GitHub Pages' /repo/) — same convention as
// useVersionCheck's version.json fetch. BASE_URL always ends with "/".
const BASE = import.meta.env.BASE_URL;

const ENGINES = {
  xcross: { url: `${BASE}trainers/xcross/worker.js`, warmup: { scr: "R ", len: "1" } },
  eocross: { url: `${BASE}trainers/eocross/worker.js`, warmup: { scr: "R ", len: "1" } },
  pairing: { url: `${BASE}trainers/pairing/worker.js`, warmup: { scr: "R ", len: "1" } },
  "xxcross-adj": {
    url: `${BASE}trainers/xxcross/worker_prod.js`,
    warmup: { scr: "R ", len: "1", pairType: "adj", bucketModel: "MOBILE_LOW" },
  },
  "xxcross-opp": {
    url: `${BASE}trainers/xxcross/worker_prod.js`,
    warmup: { scr: "R ", len: "1", pairType: "opp", bucketModel: "MOBILE_LOW" },
  },
} satisfies Record<string, EngineSpec>;

export type EngineKey = keyof typeof ENGINES;

export const TRAINER_MAX_DEPTHS: Record<EngineKey, number> = {
  xcross: 10,
  eocross: 10,
  pairing: 9,
  "xxcross-adj": 10,
  "xxcross-opp": 10,
};

const lanes = new Map<EngineKey, WorkerLane>();

const REQUEST_TIMEOUT_MS = 120_000;

function askRaw(worker: Worker, payload: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.onmessage = null;
      reject(new Error("trainer worker request timed out"));
    }, REQUEST_TIMEOUT_MS);
    worker.onmessage = (e: MessageEvent<string>) => {
      worker.onmessage = null;
      clearTimeout(timeout);
      if (e.data === "Error" || e.data === "Initial Error") {
        reject(new Error(`trainer worker returned "${e.data}"`));
      } else {
        resolve(e.data);
      }
    };
    worker.postMessage(payload);
  });
}

function getLane(key: EngineKey): WorkerLane {
  let lane = lanes.get(key);
  if (!lane) {
    const spec = ENGINES[key];
    const workerPromise = new Promise<Worker>((resolve, reject) => {
      const worker = new Worker(spec.url);
      worker.onerror = (e) => {
        lanes.delete(key);
        reject(new Error(`trainer worker failed to load (${spec.url}): ${e.message}`));
      };
      // No explicit ready signal — the warm-up reply IS the readiness probe
      // (the worker queues messages until its tables are built).
      askRaw(worker, spec.warmup).then(
        () => {
          const l = lanes.get(key);
          if (l) l.ready = true;
          resolve(worker);
        },
        (err) => {
          lanes.delete(key);
          reject(err);
        }
      );
    });
    lane = { workerPromise, chain: Promise.resolve(), ready: false };
    lanes.set(key, lane);
  }
  return lane;
}

/** True once the engine's tables are built (false also when not yet created). */
export function isEngineReady(key: EngineKey): boolean {
  return lanes.get(key)?.ready ?? false;
}

/** Kick off (or await) table building — call early so the first real request doesn't pay the init cost. */
export async function initEngine(key: EngineKey): Promise<void> {
  await getLane(key).workerPromise;
}

async function ask(key: EngineKey, scrambleTokens: readonly string[], sampleDepth: number): Promise<{ sent: string; raw: string }> {
  const lane = getLane(key);
  const worker = await lane.workerPromise;
  const spec = ENGINES[key];
  const sent = scrambleTokens.join(" ") + " "; // trailing space — see module doc
  const payload = { ...spec.warmup, scr: sent, len: String(sampleDepth) };
  const request = lane.chain.then(() => askRaw(worker, payload));
  lane.chain = request.catch(() => undefined);
  const raw = await request;
  if (!raw.startsWith(sent)) {
    throw new Error(`trainer worker (${key}) returned an unexpected response: "${raw.slice(0, 80)}…"`);
  }
  return { sent, raw };
}

const tokenize = (s: string) => s.trim().split(/\s+/).filter(Boolean);

export interface TrainerFuncResult {
  /** Optimal native-frame solution of the scramble that was sent. */
  solutionOfScramble: string[];
  /** Optimal solution of a random exactly-depth-N state. */
  solutionOfSampledState: string[];
}

/** 2-part engines: xcross, eocross, xxcross-adj/opp. */
export async function trainerFunc(key: Exclude<EngineKey, "pairing">, scrambleTokens: readonly string[], sampleDepth: number): Promise<TrainerFuncResult> {
  const { sent, raw } = await ask(key, scrambleTokens, sampleDepth);
  const parts = raw.slice(sent.length).split(",");
  if (parts.length !== 2) throw new Error(`trainer worker (${key}) returned ${parts.length} parts, expected 2`);
  return {
    solutionOfScramble: tokenize(parts[0]),
    solutionOfSampledState: tokenize(parts[1]),
  };
}

export interface PairingFuncResult extends TrainerFuncResult {
  /** Generator from the inserted state to the goal state A lands on. */
  applOfScramble: string[];
  /** Generator from the inserted state to the goal state B (the sampled state's solution) lands on. */
  applOfSampledState: string[];
}

/** 4-part engine: pairing ("free pair"). */
export async function pairingFunc(scrambleTokens: readonly string[], sampleDepth: number): Promise<PairingFuncResult> {
  const { sent, raw } = await ask("pairing", scrambleTokens, sampleDepth);
  const parts = raw.slice(sent.length).split(",");
  if (parts.length !== 4) throw new Error(`pairing worker returned ${parts.length} parts, expected 4`);
  return {
    solutionOfScramble: tokenize(parts[0]),
    applOfScramble: tokenize(parts[1]),
    solutionOfSampledState: tokenize(parts[2]),
    applOfSampledState: tokenize(parts[3]),
  };
}

// ─── Back-compat aliases for the phase-2 xcross API ───

export const XCROSS_MAX_DEPTH = TRAINER_MAX_DEPTHS.xcross;

export function isXCrossEngineReady(): boolean {
  return isEngineReady("xcross");
}

export function initXCrossEngine(): Promise<void> {
  return initEngine("xcross");
}

export function xcrossFunc(scrambleTokens: readonly string[], sampleDepth: number): Promise<TrainerFuncResult> {
  return trainerFunc("xcross", scrambleTokens, sampleDepth);
}
