/**
 * DebugPage — raw move log from the Bluetooth cube with live 3D visualisation.
 *
 * Ported from cube_trainer's DebugPage: a passive diagnostic tool, not a
 * trainer mode — no scramble/timer/session, just "every move the connected
 * cube reports, in order, with timestamps" plus a live 3D mirror to
 * visually confirm the cube state matches the physical cube. Useful for
 * checking hardware wiring/latency/notation correctness.
 *
 * Left panel: optional CubeVisualisation that tracks every incoming move.
 * Right panel: scrollable move log table with relative and absolute timestamps.
 * Header: connect/disconnect the cube, toggle cube visibility, reset cube
 * state, clear move log.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Trash2, RotateCcw, Box } from "lucide-react";
import { useSmartCube } from "../hooks/useSmartCube";
import { ConnectionPanel } from "../components/ConnectionPanel";
import { CubeVisualisation, type CubeVisualisationRef } from "../components/CubeVisualisation";

interface MoveEntry {
  id: number;
  move: string;
  timestamp: number;
  relativeMs: number;
}

let nextId = 0;

function formatRelative(ms: number): string {
  const s = Math.floor(ms / 1000);
  const frac = String(Math.floor(ms % 1000)).padStart(3, "0");
  return `${s}.${frac}`;
}

function formatAbsolute(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions);
}

export default function DebugPage() {
  const [moves, setMoves] = useState<MoveEntry[]>([]);
  const [showCube, setShowCube] = useState(true);
  const startTimeRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<CubeVisualisationRef>(null);

  const handleMove = useCallback((move: string, timestampMs: number) => {
    if (startTimeRef.current === null) startTimeRef.current = timestampMs;
    const relativeMs = timestampMs - startTimeRef.current;

    setMoves((prev) => [...prev, { id: nextId++, move, timestamp: Date.now(), relativeMs }]);
    cubeRef.current?.addMove(move);
  }, []);

  const cube = useSmartCube({ onMove: handleMove });

  // Auto-scroll to the newest move.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves.length]);

  function clearLog() {
    setMoves([]);
    startTimeRef.current = null;
  }

  function resetCube() {
    cubeRef.current?.reset();
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white">Cube Move Log</h1>
          <span className="text-xs text-gray-500 tabular-nums">
            {moves.length} move{moves.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCube((v) => !v)}
            title={showCube ? "Hide cube" : "Show cube"}
            className={`btn-secondary ${showCube ? "text-[var(--accent-bright)] border-[var(--accent)]/30 bg-[var(--accent)]/10" : ""}`}
          >
            <Box size={12} />
            Cube
          </button>

          <button onClick={resetCube} disabled={!showCube} title="Reset cube to solved state" className="btn-secondary">
            <RotateCcw size={12} />
            Reset
          </button>

          <button onClick={clearLog} disabled={moves.length === 0} title="Clear move log" className="btn-danger">
            <Trash2 size={12} />
            Clear
          </button>

          <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {showCube && (
          <div className="flex-none w-72 xl:w-96 border-r border-white/[0.06] flex items-center justify-center p-6">
            <div className="w-full aspect-square">
              <CubeVisualisation ref={cubeRef} visualization="3D" background="none" controlPanel="none" dragInput="none" className="size-full" />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 font-mono text-sm">
          {moves.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-gray-600">
              <p className="text-base">No moves yet</p>
              <p className="text-xs">Make a move on the connected Bluetooth cube</p>
            </div>
          ) : (
            <table className="w-full max-w-xl">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/[0.06]">
                  <th className="pb-2 pr-6 font-semibold">#</th>
                  <th className="pb-2 pr-6 font-semibold">Move</th>
                  <th className="pb-2 pr-6 font-semibold">Relative (s)</th>
                  <th className="pb-2 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((entry, i) => (
                  <tr key={entry.id} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                    <td className="py-1.5 pr-6 text-gray-600 tabular-nums">{i + 1}</td>
                    <td className="py-1.5 pr-6 font-bold text-base w-16" style={{ color: "var(--accent-bright)" }}>
                      {entry.move}
                    </td>
                    <td className="py-1.5 pr-6 text-gray-400 tabular-nums">{formatRelative(entry.relativeMs)}</td>
                    <td className="py-1.5 text-gray-600 tabular-nums text-xs">{formatAbsolute(entry.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
