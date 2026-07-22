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
 *   <CubeVisualisation ref={ref} visualization="3D" />
 *   ref.current?.addMove("R");
 *   const solved = await ref.current?.isSolved();
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { TwistyPlayer } from "cubing/twisty";
import type { StickeringMaskOrbits, VisualizationMode } from "../types/cube";

export type { VisualizationMode };

/**
 * Camera distance that keeps floating hint stickers in frame.
 *
 * cubing.js fixes the 3x3 Cube3D camera at distance 6, tuned for the
 * DEFAULT hint elevation (1.45) — raise the elevation and the stickers
 * leave the canvas. Scale the distance with the scene's outermost extent:
 * the cube spans ~1.5 half-units and hint stickers sit ~(elevation − 0.5)
 * beyond the face, so extent grows as (1 + elevation) and 6 corresponds
 * to the default's (1 + 1.45). Never zoom in closer than the default.
 */
const DEFAULT_CAMERA_DISTANCE = 6;
const DEFAULT_HINT_ELEVATION = 1.45;
function cameraDistanceFor(hintFacelets: "none" | "floating", elevation: number | undefined): number {
  if (hintFacelets !== "floating" || elevation === undefined || elevation <= DEFAULT_HINT_ELEVATION) {
    return DEFAULT_CAMERA_DISTANCE;
  }
  return (DEFAULT_CAMERA_DISTANCE * (1 + elevation)) / (1 + DEFAULT_HINT_ELEVATION);
}

export interface CubeVisualisationProps {
  /** Algorithm moves to display (applied after setup). */
  alg?: string;
  /** Setup algorithm — puts the cube into a specific state. */
  setupAlg?: string;
  setupAnchor?: "start" | "end";
  visualization?: VisualizationMode;
  hintFacelets?: "none" | "floating";
  /**
   * Distance of floating hint stickers from the cube (Cube3D units: main
   * stickers at 0.503, library default 1.45). Only the "3D" (Cube3D)
   * visualization honours it — PG3D silently ignores it (cubing.js #415).
   */
  hintFaceletsElevation?: number;
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
      visualization = "3D",
      hintFacelets = "none",
      hintFaceletsElevation,
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
    // Which of the two mutually-exclusive stickering channels the CURRENTLY
    // mounted player is on — see the stickeringMaskOrbits doc comment above.
    // Needed because switching channels requires tearing the player down and
    // recreating it; a plain property assignment silently does nothing.
    const stickeringChannelRef = useRef<"mask" | "named" | null>(null);

    // Builds a fresh TwistyPlayer with every "set once, driven imperatively
    // after that" prop applied — used both for the initial mount and for
    // remounting when the stickering channel flips (see below). Reads props
    // via closure, so it always reflects whatever's current when called.
    function createPlayer(): TwistyPlayer {
      const player = new TwistyPlayer();

      player.puzzle = "3x3x3";
      player.visualization = visualization as TwistyPlayer["visualization"];
      player.experimentalSetupAnchor = setupAnchor as TwistyPlayer["experimentalSetupAnchor"];
      player.background = background as TwistyPlayer["background"];
      player.controlPanel = controlPanel as TwistyPlayer["controlPanel"];
      player.viewerLink = viewerLink as TwistyPlayer["viewerLink"];
      player.hintFacelets = hintFacelets as TwistyPlayer["hintFacelets"];
      if (hintFaceletsElevation !== undefined) {
        player.experimentalHintFaceletsElevation = hintFaceletsElevation;
        player.cameraDistance = cameraDistanceFor(hintFacelets, hintFaceletsElevation);
      }
      player.experimentalDragInput = dragInput as TwistyPlayer["experimentalDragInput"];
      player.cameraLatitude = cameraLatitude;
      player.cameraLongitude = cameraLongitude;
      player.tempoScale = tempoScale;
      if (stickeringMaskOrbits) {
        player.experimentalStickeringMaskOrbits = stickeringMaskOrbits;
        stickeringChannelRef.current = "mask";
      } else {
        player.experimentalStickering = stickering;
        stickeringChannelRef.current = "named";
      }

      // Size must be set as inline style directly on the web component
      // element — CSS classes on the wrapper div don't cascade into its
      // shadow DOM.
      player.style.width = "100%";
      player.style.height = "100%";
      return player;
    }

    useEffect(() => {
      if (!containerRef.current) return;

      const player = createPlayer();
      player.alg = alg;
      if (setupAlg) player.experimentalSetupAlg = setupAlg;

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
      const oldPlayer = playerRef.current;
      if (!oldPlayer || !containerRef.current) return;

      const wantsChannel = stickeringMaskOrbits ? "mask" : "named";
      if (stickeringChannelRef.current === wantsChannel) {
        // Same channel — a plain property update takes effect fine.
        if (stickeringMaskOrbits) oldPlayer.experimentalStickeringMaskOrbits = stickeringMaskOrbits;
        else oldPlayer.experimentalStickering = stickering;
        return;
      }

      // Channel flip (mask <-> named): the old player is permanently stuck
      // showing whichever channel it was first given, so swap in a fresh
      // one instead. Can't carry over its current alg/setup — TwistyPlayer's
      // `alg`/`experimentalSetupAlg` are write-only, reading them throws —
      // but in practice this only fires when the caller is switching to a
      // whole new group/case, which drives a fresh setSetupAlgorithm/reset
      // through the imperative ref right after anyway (see TrainingPage's
      // case-loading effect), so the momentary reset-to-blank here doesn't
      // linger.
      const newPlayer = createPlayer();
      newPlayer.alg = alg;
      if (setupAlg) newPlayer.experimentalSetupAlg = setupAlg;
      containerRef.current.replaceChild(newPlayer, oldPlayer);
      oldPlayer.remove();
      playerRef.current = newPlayer;
    }, [stickering, stickeringMaskOrbits]);

    useEffect(() => {
      if (!playerRef.current) return;
      playerRef.current.visualization = visualization as TwistyPlayer["visualization"];
    }, [visualization]);

    useEffect(() => {
      if (!playerRef.current) return;
      playerRef.current.hintFacelets = hintFacelets as TwistyPlayer["hintFacelets"];
    }, [hintFacelets]);

    useEffect(() => {
      if (!playerRef.current || hintFaceletsElevation === undefined) return;
      playerRef.current.experimentalHintFaceletsElevation = hintFaceletsElevation;
      playerRef.current.cameraDistance = cameraDistanceFor(hintFacelets, hintFaceletsElevation);
    }, [hintFacelets, hintFaceletsElevation]);

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
