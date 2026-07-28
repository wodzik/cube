/**
 * Bump this by hand whenever a deploy changes the BUILT-IN algorithm
 * defaults (new/changed cases, re-scraped sets, mask fixes) in a way users
 * should know about — it drives the dismissable "algorithms updated"
 * notice (see useAlgorithmDataVersionCheck/AlgorithmDataUpdateNotice) that
 * offers a one-click "clear my progress and start fresh on the new set"
 * alongside "keep what I have". Unrelated to __BUILD_ID__ (that's every
 * deploy, forces a reload for stale JS chunks) — this is opt-in and only
 * for changes to the shipped algorithm data itself.
 */
export const ALGORITHM_DATA_VERSION = 4;
