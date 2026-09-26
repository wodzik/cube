/**
 * Wrapper around cubecore's <cube-player> (the cube view with skins, masks,
 * back view, 2D pictures) — same props and ref API as the old TwistyPlayer
 * wrapper, so callers don't change.
 *
 * RESPONSIBILITY:
 * - Mount and manage a <cube-player> element
 * - Expose an imperative ref API for parent components to drive the visualisation
 * - Check isSolved() on the shown state (any orientation)
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
import "@cubecore/element"; // registers <cube-player>
import type { CubePlayer } from "@cubecore/element";
import { SKINS, type Skin } from "@cubecore/render";
import { isSolved } from "@cubecore/core";
import type { StickeringMaskOrbits, VisualizationMode } from "../types/cube";
import { namedMaskToCubecore, orbitMaskToCubecore } from "../logic/cubecoreMask";

export type { VisualizationMode };

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
  /** Second view of the hidden faces from behind: a corner inset or two cubes side by side. */
  backView?: "none" | "top-right" | "side-by-side";
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
  /**
   * Set a new setup state, optionally with a new algorithm. Lands on
   * `jumpTo` ("end" by default, matching every existing caller — they show
   * the case already-solved/complete) — pass "start" when the caller wants
   * the player parked ready to press play from the beginning instead (e.g.
   * a from-scratch algorithm tester).
   */
  setSetupAlgorithm: (setup: string, alg?: string, jumpTo?: "start" | "end") => void;
  setVisualization: (mode: VisualizationMode) => void;
  /** Start (or resume) playback — a fresh/mounted player never autoplays on its own. */
  play: () => void;
  /** Async: true if the current cube state is solved (orientation-agnostic). */
  isSolved: () => Promise<boolean>;
  /** Scrub the timeline to the moment right before the given move index plays (e.g. jump to a stage boundary). */
  setMoveIndex: (moveIndex: number) => void;
}

/** cubing.js visualization names → <cube-player> views. */
const VIEW: Record<VisualizationMode, string> = { "3D": "3d", PG3D: "3d", "2D": "net", "experimental-2D-LL": "top" };

export const CubeVisualisation = forwardRef<CubeVisualisationRef, CubeVisualisationProps>(
  (
    {
      alg = "",
      setupAlg,
      setupAnchor = "start",
      visualization = "3D",
      hintFacelets = "none",
      hintFaceletsElevation,
      backView = "none",
      stickering = "full",
      stickeringMaskOrbits,
      controlPanel = "none",
      cameraLatitude = 20,
      cameraLongitude = 20,
      tempoScale = 5,
      className = "",
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<CubePlayer | null>(null);

    // The skin: the default look, with floating back stickers when asked.
    const skinFor = (): Skin => ({
      ...SKINS.default,
      hints: { ...SKINS.default.hints, enabled: hintFacelets === "floating", distance: hintFaceletsElevation ?? SKINS.default.hints.distance },
    });
    const applyMask = (p: CubePlayer) => {
      p.mask = stickeringMaskOrbits ? orbitMaskToCubecore(stickeringMaskOrbits) : namedMaskToCubecore(stickering);
    };
    const applyCamera = (p: CubePlayer) => p.renderer?.setCamera({ latitude: cameraLatitude, longitude: cameraLongitude });

    useEffect(() => {
      if (!containerRef.current) return;
      const p = document.createElement("cube-player") as CubePlayer;
      if (controlPanel === "none") p.setAttribute("controls", "none");
      p.setAttribute("visualization", VIEW[visualization] ?? "3d");
      p.setAttribute("anchor", setupAnchor);
      p.setAttribute("tempo", String(Math.max(1, tempoScale * 2)));
      p.setAttribute("back-view", backView);
      p.style.width = "100%";
      p.style.height = "100%";
      // Fit whatever box the page gives it (the element's own 200px minimum is for standalone use).
      p.style.minWidth = "0";
      p.style.minHeight = "0";
      p.skin = skinFor();
      if (setupAlg) p.setup = setupAlg;
      p.alg = alg;
      containerRef.current.appendChild(p);
      playerRef.current = p;
      applyMask(p);
      applyCamera(p);
      return () => {
        p.remove();
        playerRef.current = null;
      };
      // Mounted once and driven imperatively.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (playerRef.current) applyMask(playerRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stickering, stickeringMaskOrbits]);
    useEffect(() => {
      playerRef.current?.setAttribute("visualization", VIEW[visualization] ?? "3d");
    }, [visualization]);
    useEffect(() => {
      if (playerRef.current) playerRef.current.skin = skinFor();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hintFacelets, hintFaceletsElevation]);
    useEffect(() => {
      playerRef.current?.setAttribute("back-view", backView);
    }, [backView]);
    useEffect(() => {
      if (playerRef.current) applyCamera(playerRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cameraLatitude, cameraLongitude]);

    useImperativeHandle(ref, () => ({
      addMove: (move: string) => {
        const trimmed = move.trim();
        if (trimmed) playerRef.current?.pushMove(trimmed);
      },
      reset: () => {
        const p = playerRef.current;
        if (!p) return;
        p.setup = "";
        p.alg = "";
      },
      setAlgorithm: (newAlg: string) => {
        const p = playerRef.current;
        if (!p) return;
        p.alg = newAlg;
        p.toStart();
      },
      setSetupAlgorithm: (setup: string, newAlg = "", jumpTo: "start" | "end" = "end") => {
        const p = playerRef.current;
        if (!p) return;
        p.setup = setup;
        p.alg = newAlg;
        if (jumpTo === "start") p.toStart();
        else p.toEnd();
      },
      setVisualization: (mode: VisualizationMode) => {
        playerRef.current?.setAttribute("visualization", VIEW[mode] ?? "3d");
      },
      play: () => {
        playerRef.current?.play();
      },
      isSolved: async () => {
        const state = playerRef.current?.renderer?.currentState;
        return state ? isSolved(state) : false;
      },
      setMoveIndex: (moveIndex: number) => {
        playerRef.current?.seekToMove(moveIndex);
      },
    }));

    return <div ref={containerRef} className={`size-full ${className}`} />;
  }
);

CubeVisualisation.displayName = "CubeVisualisation";
