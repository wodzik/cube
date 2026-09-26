/**
 * Algorithm case visualisation — shows the cube state a solver needs to
 * recognise before applying the given algorithm.
 *
 * Wraps CubeVisualisation with setupAlg = inverse(alg), alg = "" (static,
 * no animation). `stickering`/`visualization` decide 2D-last-layer vs full
 * 3D — driven by logic/algGroupConfig.ts per group (OLL/PLL -> 2D, F2L -> 3D).
 *
 * Uses buildCanonicalDisplaySetupAlg, NOT buildCaseSetupAlg — this
 * component never tracks/animates a move against its setup (alg is always
 * ""), so unlike every OTHER buildCaseSetupAlg caller it's free to invert a
 * matched "regrip and restore" rotation pair (e.g. bundled PLL Aa's own "x
 * (moves) x'") as a whole instead of leaving one half stripped — see that
 * function's doc comment for why the two must stay separate.
 *
 * Performance: a grid of 40+ cases. 3D cases are still PICTURES drawn by
 * cubecore's one shared renderer (sharedPictures — browsers allow only ~16
 * live WebGL contexts, a player per card blanked most of them); 2D ones are
 * SVG players (no WebGL). Either way nothing is drawn until the card is
 * near the viewport (IntersectionObserver).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { applyMoves, solvedState } from "@cubecore/core";
import { sharedPictures } from "@cubecore/render";
import type { Skin } from "@cubecore/render";
import { CubeVisualisation, type CubeVisualisationRef, type VisualizationMode } from "./CubeVisualisation";
import { buildCanonicalDisplaySetupAlg } from "../logic/moveParser";
import { namedMaskToCubecore, orbitMaskToCubecore } from "../logic/cubecoreMask";
import { useCubeLook } from "../hooks/useCubeLook";

/** A short stable id per skin object (for the picture cache key). */
const skinIds = new WeakMap<Skin, number>();
let nextSkinId = 1;
const skinId = (s: Skin) => {
  if (!skinIds.has(s)) skinIds.set(s, nextSkinId++);
  return skinIds.get(s)!;
};
const pageTheme = () => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");

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
  const inverseAlg = useMemo(() => buildCanonicalDisplaySetupAlg(alg), [alg]);

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


  const is3d = visualization === "3D" || visualization === "PG3D";
  const { skin } = useCubeLook();
  const picture = useMemo(() => {
    if (!visible || !is3d) return null;
    try {
      const mask = stickeringMaskOrbits ? orbitMaskToCubecore(stickeringMaskOrbits) : namedMaskToCubecore(stickering);
      const theme = pageTheme();
      const key = [inverseAlg, stickeringMaskOrbits ? JSON.stringify(stickeringMaskOrbits) : stickering, cameraLatitude, cameraLongitude, skinId(skin), theme].join("|");
      return sharedPictures().draw({ state: applyMoves(solvedState(), inverseAlg), mask, skin, theme, camera: { latitude: cameraLatitude, longitude: cameraLongitude } }, key);
    } catch {
      return null;
    }
  }, [visible, is3d, inverseAlg, stickering, stickeringMaskOrbits, cameraLatitude, cameraLongitude, skin]);

  return (
    <div ref={wrapperRef} className={`size-full ${className}`}>
      {picture && <img src={picture} alt="" draggable={false} className="size-full object-contain select-none" />}
      {visible && !is3d && (
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
