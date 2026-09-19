/**
 * Reads a share link (`#s=<payload>`, see logic/shareLink.ts) from the URL:
 * on load and whenever the hash changes (pasting another link into a tab that
 * is already open). `close` clears the hash without adding a history entry, so
 * a reload doesn't reopen the preview.
 */

import { useCallback, useEffect, useState } from "react";
import { decodeSolve, parseShareHash, type SharedSolve } from "../logic/shareLink";

export type SharedSolveState = { status: "ok"; shared: SharedSolve } | { status: "invalid" } | null;

function readHash(): SharedSolveState {
  if (typeof location === "undefined") return null;
  const payload = parseShareHash(location.hash);
  if (payload === null) return null;
  const shared = decodeSolve(payload);
  return shared ? { status: "ok", shared } : { status: "invalid" };
}

export function useSharedSolve(): { state: SharedSolveState; close: () => void } {
  const [state, setState] = useState<SharedSolveState>(readHash);

  useEffect(() => {
    const onHashChange = () => setState(readHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const close = useCallback(() => {
    history.replaceState(null, "", location.pathname + location.search);
    setState(null);
  }, []);

  return { state, close };
}
