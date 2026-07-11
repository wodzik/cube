/**
 * Async scramble generation (cubing/scramble) → sets it as the session target.
 * A scramble is just another target sequence from the reducer's point of
 * view — see sessionReducer's TARGET_READY handling.
 */

import { useCallback, useState } from "react";
import { randomScrambleForEvent } from "cubing/scramble";
import { useSession } from "../state/sessionContext";

export interface UseScrambleGeneratorReturn {
  generate: () => Promise<void>;
  isGenerating: boolean;
  error: string | null;
}

export function useScrambleGenerator(): UseScrambleGeneratorReturn {
  const { setTarget } = useSession();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const scramble = await randomScrambleForEvent("333");
      setTarget(scramble.toString().trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate scramble");
    } finally {
      setIsGenerating(false);
    }
  }, [setTarget]);

  return { generate, isGenerating, error };
}
