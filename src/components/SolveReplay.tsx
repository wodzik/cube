/**
 * SolveReplay — a recorded solve on cubecore's <cube-player>: the scramble,
 * then every move at the moment it was made (real time, pauses included),
 * with the stages as a segmented bar over the controls (recognition hatched,
 * same colours as SolveTimingBar) — hover / playhead shows the stage, click
 * a stage to jump there.
 *
 * `seekToStage` (ref) jumps to a stage's start (the stage rows in
 * SolveAnalysis).
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "@cubecore/element";
import type { CubePlayer } from "@cubecore/element";
import { parseAlg } from "@cubecore/core";
import type { Segment } from "@cubecore/timeline";
import type { SolveRecord } from "../types/solve";
import type { StageTiming } from "../logic/stageDetection/stageTiming";
import { useCubeLook } from "../hooks/useCubeLook";
import { groupStageTimings, stageGroupShades, stageSlotLabel } from "./stageGroups";
import { stageCubeColors } from "./cubeColors";

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
          split: at + t.recognitionMs,
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

export const SolveReplay = forwardRef<SolveReplayRef, { record: SolveRecord; timings: readonly StageTiming[]; className?: string }>(
  ({ record, timings, className = "" }, ref) => {
    const host = useRef<HTMLDivElement>(null);
    const player = useRef<CubePlayer | null>(null);
    const segmentsRef = useRef<Segment[]>([]);
    const { skin } = useCubeLook();

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
      const themeWatch = new MutationObserver(() => {
        p.setAttribute("theme", pageTheme());
        p.style.color = pageTheme() === "light" ? "#1f2937" : "#e5e7eb";
      });
      themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => {
        themeWatch.disconnect();
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
      const moves = record.moves.flatMap((m) => parseAlg(m.move).map((move) => ({ move, t: Math.max(0, m.relativeMs) })));
      p.recording = { scramble: parseAlg(record.scramble), moves, totalMs: Math.max(record.timeMs, moves.at(-1)?.t ?? 0) };
    }, [record]);

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
        else p.seekToMove(moveIndex);
      },
    }));

    return <div ref={host} className={className} />;
  }
);
SolveReplay.displayName = "SolveReplay";
