/**
 * Algorithm case visualisation — shows the cube state a solver needs to
 * recognise before applying the given algorithm.
 *
 * Wraps CubeVisualisation with setupAlg = inverse(alg), alg = "" (static,
 * no animation). `stickering`/`visualization` decide 2D-last-layer vs full
 * 3D — driven by logic/algGroupConfig.ts per group (OLL/PLL -> 2D, F2L -> 3D).
 *
 * Performance: TwistyPlayer is expensive to mount (WebGL/SVG init). A grid
 * of 40+ cases would otherwise mount 40+ contexts at once, so mounting is
 * deferred via IntersectionObserver until the card is near the viewport;
 * once mounted it stays mounted.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { CubeVisualisation, type CubeVisualisationRef, type VisualizationMode } from "./CubeVisualisation";
import { buildCaseSetupAlg } from "../logic/moveParser";

interface AlgCaseVisualisationProps {
  /** The solution algorithm — the visualisation shows the state BEFORE this is applied. */
  alg: string;
  stickering?: string;
  /** Piece-level mask (overrides `stickering`) — see CubeVisualisation. */
  stickeringMaskOrbits?: import("../types/cube").StickeringMaskOrbits;
  visualization?: VisualizationMode;
  cameraLatitude?: number;
  cameraLongitude?: number;
  className?: string;
}

export function AlgCaseVisualisation({
  alg,
  stickering = "full",
  stickeringMaskOrbits,
  visualization = "experimental-2D-LL",
  cameraLatitude = 30,
  cameraLongitude = -30,
  className = "",
}: AlgCaseVisualisationProps) {
  const cubeRef = useRef<CubeVisualisationRef>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inverseAlg = useMemo(() => buildCaseSetupAlg(alg), [alg]);

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Update the live player in place when the algorithm changes (e.g. user
  // switches the default variant while editing) — avoids remount cost.
  useEffect(() => {
    if (!visible) return;
    cubeRef.current?.setSetupAlgorithm(inverseAlg, "");
  }, [inverseAlg, visible]);

  return (
    <div ref={wrapperRef} className={`size-full ${className}`}>
      {visible && (
        <CubeVisualisation
          ref={cubeRef}
          setupAlg={inverseAlg}
          setupAnchor="start"
          alg=""
          visualization={visualization}
          stickering={stickering}
          stickeringMaskOrbits={stickeringMaskOrbits}
          background="none"
          controlPanel="none"
          dragInput="none"
          cameraLatitude={cameraLatitude}
          cameraLongitude={cameraLongitude}
          tempoScale={1}
          className="size-full"
        />
      )}
    </div>
  );
}
