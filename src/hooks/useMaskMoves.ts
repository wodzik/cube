/**
 * Persisted "hide algorithm" preference for Training/Attack — shared across
 * both pages (one toggle, same meaning everywhere) via a single localStorage
 * key. Not used on Solve: the scramble must be readable to perform it.
 */

import { useState } from "react";

const STORAGE_KEY = "nact_mask_moves";

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export interface UseMaskMovesReturn {
  maskMoves: boolean;
  toggleMaskMoves: () => void;
}

export function useMaskMoves(): UseMaskMovesReturn {
  const [maskMoves, setMaskMoves] = useState<boolean>(readStored);

  const toggleMaskMoves = () => {
    setMaskMoves((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // localStorage unavailable — preference just won't persist across reloads.
      }
      return next;
    });
  };

  return { maskMoves, toggleMaskMoves };
}
