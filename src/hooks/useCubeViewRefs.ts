/**
 * Main 3D cube ref + auxiliary flat (unfolded-net) cube ref, with a `view`
 * facade that fans every imperative call out to both — so the flat player
 * (always mounted by TrainerPanel, merely hidden while its toggle is off)
 * never falls out of sync with the 3D one. Same pattern the Case Trainer
 * established; this hook lets every page reuse it.
 */

import { useMemo, useRef } from "react";
import type { CubeVisualisationRef } from "../components/CubeVisualisation";

export function useCubeViewRefs() {
  const cubeRef = useRef<CubeVisualisationRef>(null);
  const flatCubeRef = useRef<CubeVisualisationRef>(null);

  const view = useMemo(
    () => ({
      addMove: (move: string) => {
        cubeRef.current?.addMove(move);
        flatCubeRef.current?.addMove(move);
      },
      reset: () => {
        cubeRef.current?.reset();
        flatCubeRef.current?.reset();
      },
      setSetupAlgorithm: (setup: string, alg = "") => {
        cubeRef.current?.setSetupAlgorithm(setup, alg);
        flatCubeRef.current?.setSetupAlgorithm(setup, alg);
      },
    }),
    []
  );

  return { cubeRef, flatCubeRef, view };
}
