/**
 * SolveReplay — a recorded solve on cubecore's <cube-player>: the scramble,
 * then every move at the moment it was made (real time, pauses included),
 * with the stages as a segmented bar over the controls (recognition hatched,
 * same colours as SolveTimingBar) — hover / playhead shows the stage, click
 * a stage to jump there.
 *
 * With rotations recorded (gyroscope), it's replayed as it was held: the
 * cube picked up in its grip, the x / y / z at their moments.
 *
 * `seekToStage` (ref) jumps to a stage's start (the stage rows in
 * SolveAnalysis).
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "@wodzik/cubecore/element";
import type { CubePlayer } from "@wodzik/cubecore/element";
import { type Move, parseAlg } from "@wodzik/cubecore/core";
import type { Segment } from "@wodzik/cubecore/timeline";
import type { SolveRecord } from "../types/solve";
import type { StageTiming } from "../logic/stageDetection/stageTiming";
import { useCubeLook } from "../hooks/useCubeLook";
import { groupStageTimings, stageGroupShades, stageSlotLabel } from "./stageGroups";
import { stageCubeColors } from "./cubeColors";
import { useMoveReading } from "../hooks/useMoveReading";
import { type CurrentItem, type DisplayItem, heldTokens, plainTokens, playbackItems } from "../logic/solveRotations";

export interface SolveReplayRef {
  /** Jump to the stage's start (else, with no timed stages — a move-count-only session — to the raw move index). */
  seekToStage: (stage: string, moveIndex: number) => void;
}

/** The stages as player segments: back to back from the timer start, recognition first. */
export function stageSegmentsFor(timings: readonly StageTiming[]): Segment[] {
  const segments: Segment[] = [];
  let at = 0;
  for (const group of groupStageTimings(timings)) {
    const [base, alt] = stageGroupShades(group.label);
    group.timings
      .filter((t) => t.totalMs > 0)
      .forEach((t, i) => {
        const cube = stageCubeColors(t, timings);
        const slot = stageSlotLabel(t.stage);
        segments.push({
          start: at,
          ...(t.recognitionMs > 0 ? { split: at + t.recognitionMs } : {}),
          end: at + t.totalMs,
          label: group.label,
          detail: group.timings.length > 1 ? (slot ?? t.stage) : undefined,
          id: t.stage,
          moves: t.moveCount,
          color: cube?.[0] ?? (i % 2 === 0 ? base : alt),
        });
        at += t.totalMs;
      });
  }
  return segments;
}

const pageTheme = () => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");

interface SolveReplayProps {
  record: SolveRecord;
  timings: readonly StageTiming[];
  className?: string;
  /** The move (or rotation) last played — for marking it in the move lists. */
  onCurrent?: (current: CurrentItem | null) => void;
}

export const SolveReplay = forwardRef<SolveReplayRef, SolveReplayProps>(
  ({ record, timings, className = "", onCurrent }, ref) => {
    const host = useRef<HTMLDivElement>(null);
    const player = useRef<CubePlayer | null>(null);
    const segmentsRef = useRef<Segment[]>([]);
    const playerIndexRef = useRef<(raw: number) => number>((i) => i);
    const itemOfMoveRef = useRef<DisplayItem[]>([]);
    const onCurrentRef = useRef(onCurrent);
    onCurrentRef.current = onCurrent;
    const { skin } = useCubeLook();
    const reading = useMoveReading();

    useEffect(() => {
      const p = document.createElement("cube-player") as CubePlayer;
      p.setAttribute("progress", "");
      p.setAttribute("markers", "");
      p.setAttribute("theme", pageTheme());
      p.style.width = "100%";
      p.style.height = "100%";
      p.style.minWidth = "0";
      p.style.minHeight = "0";
      // Controls and bar are drawn in currentColor — the page's text colour.
      p.style.color = pageTheme() === "light" ? "#1f2937" : "#e5e7eb";
      host.current?.append(p);
      player.current = p;
      let shown: DisplayItem | null = null;
      const onTime = () => {
        const item = p.applied > 0 ? (itemOfMoveRef.current[p.applied - 1] ?? null) : null;
        if (item === shown) return;
        shown = item;
        onCurrentRef.current?.(
          item ? (item.rotation ? { rotation: true, after: item.after! } : { rotation: false, first: item.first, last: item.last }) : null
        );
      };
      p.addEventListener("timeupdate", onTime);
      const themeWatch = new MutationObserver(() => {
        p.setAttribute("theme", pageTheme());
        p.style.color = pageTheme() === "light" ? "#1f2937" : "#e5e7eb";
      });
      themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => {
        themeWatch.disconnect();
        p.removeEventListener("timeupdate", onTime);
        p.remove();
        player.current = null;
      };
    }, []);

    useEffect(() => {
      if (player.current) player.current.skin = skin;
    }, [skin]);

    useEffect(() => {
      const p = player.current;
      if (!p) return;
      // With rotations recorded (gyroscope): picked up as it was held, the
      // rotations in between, each move as it was seen. One step per shown
      // move: U U is one U2 (U' U' one U2', turned that way).
      const held = heldTokens(record, reading);
      const items = playbackItems(held ?? plainTokens(record));
      const moves: { move: Move; t: number }[] = [];
      const itemOfMove: DisplayItem[] = [];
      for (const item of items)
        for (const move of parseAlg(item.move)) {
          moves.push({ move, t: Math.max(0, item.t) });
          itemOfMove.push(item);
        }
      const scramble = parseAlg(held && record.startRotation ? `${record.scramble} ${record.startRotation}` : record.scramble);
      // Raw move index → the player's (rotations and collapsed runs shift it).
      const at: number[] = [];
      itemOfMove.forEach((item, n) => {
        for (let i = item.first; i <= item.last; i++) at[i] ??= n;
      });
      playerIndexRef.current = (i) => at[i] ?? i;
      itemOfMoveRef.current = itemOfMove;
      p.recording = { scramble, moves, totalMs: Math.max(record.timeMs, moves.at(-1)?.t ?? 0) };
    }, [record, reading]);

    useEffect(() => {
      segmentsRef.current = stageSegmentsFor(timings);
      if (player.current) player.current.segments = segmentsRef.current;
    }, [timings]);

    useImperativeHandle(ref, () => ({
      seekToStage: (stage, moveIndex) => {
        const p = player.current;
        if (!p) return;
        const s = segmentsRef.current.find((x) => x.id === stage);
        if (s) p.seek(s.start);
        else p.seekToMove(playerIndexRef.current(moveIndex));
      },
    }));

    return <div ref={host} className={className} />;
  }
);
SolveReplay.displayName = "SolveReplay";
