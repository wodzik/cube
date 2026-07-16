/**
 * Wrapper around TwistyPlayer (cubing/twisty web component).
 *
 * RESPONSIBILITY:
 * - Mount and manage a TwistyPlayer DOM element
 * - Expose an imperative ref API for parent components to drive the visualisation
 * - Check isSolved() via the cubing KPattern model
 *
 * NOT responsible for: generating scrambles, tracking moves/state, solve logic.
 *
 * USAGE:
 *   const ref = useRef<CubeVisualisationRef>(null);
 *   <CubeVisualisation ref={ref} visualization="PG3D" />
 *   ref.current?.addMove("R");
 *   const solved = await ref.current?.isSolved();
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { TwistyPlayer } from "cubing/twisty";
import type { StickeringMaskOrbits, VisualizationMode } from "../types/cube";

export type { VisualizationMode };

export interface CubeVisualisationProps {
  /** Algorithm moves to display (applied after setup). */
  alg?: string;
  /** Setup algorithm — puts the cube into a specific state. */
  setupAlg?: string;
  setupAnchor?: "start" | "end";
  visualization?: VisualizationMode;
  hintFacelets?: "none" | "floating";
  /** Stickering scheme: "full" | "OLL" | "PLL" | "F2L" | etc. */
  stickering?: string;
  /**
   * Piece-level mask (overrides `stickering` when set) — e.g. "show only
   * the 4 cross edges" (see types/cube.ts). TRAP: once a mask has been set
   * on a player, assigning experimentalStickering does NOT clear it — a
   * mounted player must stick to ONE channel (mask or named stickering)
   * for its whole life, or be remounted.
   */
  stickeringMaskOrbits?: StickeringMaskOrbits;
  background?: "none" | "checkered-transparent";
  controlPanel?: "none" | "bottom-row";
  dragInput?: "auto" | "none";
  viewerLink?: "none" | "twizzle";
  cameraLatitude?: number;
  cameraLongitude?: number;
  tempoScale?: number;
  className?: string;
}

export interface CubeVisualisationRef {
  /** Append a single move to the live algorithm (used for scramble/algorithm tracking). */
  addMove: (move: string) => void;
  /** Clear the current algorithm and setup. */
  reset: () => void;
  /** Replace the full algorithm string. */
  setAlgorithm: (alg: string) => void;
  /** Set a new setup state, optionally with a new algorithm. */
  setSetupAlgorithm: (setup: string, alg?: string) => void;
  setVisualization: (mode: VisualizationMode) => void;
  /** Async: true if the current cube state is solved (orientation-agnostic). */
  isSolved: () => Promise<boolean>;
  /** Scrub the timeline to the moment right before the given move index plays (e.g. jump to a stage boundary). */
  setMoveIndex: (moveIndex: number) => void;
}

export const CubeVisualisation = forwardRef<CubeVisualisationRef, CubeVisualisationProps>(
  (
    {
      alg = "",
      setupAlg,
      setupAnchor = "start",
      visualization = "PG3D",
      hintFacelets = "none",
      stickering = "full",
      stickeringMaskOrbits,
      background = "none",
      controlPanel = "none",
      dragInput = "auto",
      viewerLink = "none",
      cameraLatitude = 20,
      cameraLongitude = 20,
      tempoScale = 5,
      className = "",
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<TwistyPlayer | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;

      // Set all properties before appending to DOM — TwistyPlayer is a web
      // component, so property assignment is equivalent to constructor
      // options but avoids the constructor's stricter typing.
      const player = new TwistyPlayer();

      player.puzzle = "3x3x3";
      player.alg = alg;
      player.visualization = visualization as TwistyPlayer["visualization"];
      player.experimentalSetupAnchor = setupAnchor as TwistyPlayer["experimentalSetupAnchor"];
      player.background = background as TwistyPlayer["background"];
      player.controlPanel = controlPanel as TwistyPlayer["controlPanel"];
      player.viewerLink = viewerLink as TwistyPlayer["viewerLink"];
      player.hintFacelets = hintFacelets as TwistyPlayer["hintFacelets"];
      player.experimentalDragInput = dragInput as TwistyPlayer["experimentalDragInput"];
      player.cameraLatitude = cameraLatitude;
      player.cameraLongitude = cameraLongitude;
      player.tempoScale = tempoScale;
      if (stickeringMaskOrbits) {
        player.experimentalStickeringMaskOrbits = stickeringMaskOrbits;
      } else {
        player.experimentalStickering = stickering;
      }

      if (setupAlg) {
        player.experimentalSetupAlg = setupAlg;
      }

      // Size must be set as inline style directly on the web component
      // element — CSS classes on the wrapper div don't cascade into its
      // shadow DOM.
      player.style.width = "100%";
      player.style.height = "100%";

      playerRef.current = player;
      containerRef.current.appendChild(player);

      return () => {
        player.remove();
        playerRef.current = null;
      };
      // Intentionally empty deps: TwistyPlayer is mounted once and driven imperatively.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (!playerRef.current) return;
      if (stickeringMaskOrbits) {
        playerRef.current.experimentalStickeringMaskOrbits = stickeringMaskOrbits;
      } else {
        playerRef.current.experimentalStickering = stickering;
      }
    }, [stickering, stickeringMaskOrbits]);

    useEffect(() => {
      if (!playerRef.current) return;
      playerRef.current.visualization = visualization as TwistyPlayer["visualization"];
    }, [visualization]);

    useEffect(() => {
      if (!playerRef.current) return;
      playerRef.current.cameraLatitude = cameraLatitude;
      playerRef.current.cameraLongitude = cameraLongitude;
    }, [cameraLatitude, cameraLongitude]);

    useImperativeHandle(ref, () => ({
      addMove: (move: string) => {
        const trimmed = move.trim();
        if (!trimmed || !playerRef.current) return;
        playerRef.current.experimentalAddMove(trimmed);
      },
      reset: () => {
        if (!playerRef.current) return;
        playerRef.current.alg = "";
        playerRef.current.experimentalSetupAlg = "";
      },
      setAlgorithm: (newAlg: string) => {
        if (!playerRef.current) return;
        playerRef.current.alg = newAlg;
      },
      setSetupAlgorithm: (setup: string, newAlg = "") => {
        if (!playerRef.current) return;
        playerRef.current.experimentalSetupAlg = setup;
        playerRef.current.alg = newAlg;
        // Replacing the setup mid-animation (e.g. the trainer swapping in
        // the next attempt's view right as the final solve move is still
        // animating) can leave the timeline frozen before the end — the
        // cube then LOOKS unsolved until the next move nudges it. Land on
        // the final state explicitly.
        playerRef.current.jumpToEnd({ flash: false });
      },
      setVisualization: (mode: VisualizationMode) => {
        if (!playerRef.current) return;
        playerRef.current.visualization = mode as TwistyPlayer["visualization"];
      },
      isSolved: async () => {
        try {
          const player = playerRef.current;
          if (!player?.experimentalModel) return false;
          const pattern = await player.experimentalModel.currentPattern.get();
          return pattern.experimentalIsSolved({
            ignorePuzzleOrientation: true,
            ignoreCenterOrientation: true,
          });
        } catch (err) {
          console.warn("CubeVisualisation: isSolved check failed", err);
          return false;
        }
      },
      setMoveIndex: (moveIndex: number) => {
        const player = playerRef.current;
        if (!player?.experimentalModel) return;
        void (async () => {
          try {
            const model = player.experimentalModel as unknown as {
              indexer: { get: () => Promise<{ indexToMoveStartTimestamp: (i: number) => number }> };
              timestampRequest: { set: (ts: number) => void };
            };
            const indexer = await model.indexer.get();
            const timestamp = indexer.indexToMoveStartTimestamp(moveIndex);
            model.timestampRequest.set(timestamp);
          } catch (err) {
            console.warn("CubeVisualisation: setMoveIndex failed", err);
          }
        })();
      },
    }));

    return <div ref={containerRef} className={`size-full ${className}`} />;
  }
);

CubeVisualisation.displayName = "CubeVisualisation";
