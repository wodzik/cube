/**
 * TryAlgorithmPanel — Debug page's second tab: paste any algorithm and
 * watch it performed on a live TwistyPlayer (its own built-in play/pause/
 * step/scrub controls — see controlPanel="bottom-row" below), no scramble
 * or session involved. Useful for eyeballing whether a pasted/scraped
 * algorithm's notation is actually valid and does what it's supposed to.
 *
 * TwistyPlayer's `alg` is write-once-on-mount (see CubeVisualisation's own
 * doc comment) — updates go through the imperative ref, same pattern as
 * AlgCaseVisualisation.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { CubeVisualisation, type CubeVisualisationRef } from "./CubeVisualisation";
import { parseMove } from "../logic/moveParser";
import { parseDecoratedAlg } from "../data/academy";

export function TryAlgorithmPanel() {
  const [input, setInput] = useState("");
  const cubeRef = useRef<CubeVisualisationRef>(null);

  const { plain, invalidTokens } = useMemo(() => {
    const { tokens } = parseDecoratedAlg(input);
    return { plain: tokens.join(" "), invalidTokens: tokens.filter((t) => !parseMove(t)) };
  }, [input]);

  const playableAlg = invalidTokens.length === 0 ? plain : "";

  useEffect(() => {
    cubeRef.current?.setAlgorithm(playableAlg);
  }, [playableAlg]);

  function clear() {
    setInput("");
  }

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-none w-72 xl:w-96 border-r border-white/[0.06] flex items-center justify-center p-6">
        <div className="w-full aspect-square bg-gray-950/50 rounded-xl overflow-hidden">
          <CubeVisualisation
            ref={cubeRef}
            visualization="3D"
            background="none"
            controlPanel="bottom-row"
            dragInput="auto"
            hintFacelets="floating"
            tempoScale={1}
            className="size-full"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Algorithm</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. R U R' U' R' F R2 U' R' U' R U R' F'"
          rows={3}
          spellCheck={false}
          className="w-full bg-gray-950/60 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
        />

        {invalidTokens.length > 0 && (
          <p className="text-xs text-red-400 mt-2">Not valid cube notation: {invalidTokens.join(" ")}</p>
        )}

        <div className="flex items-center gap-2 mt-3">
          <button onClick={clear} disabled={!input} className="btn-secondary text-xs">
            <RotateCcw size={12} /> Clear
          </button>
        </div>

        <p className="text-[11px] text-gray-600 mt-4">
          Press play or step through the moves with the controls under the cube. Drag the cube to change the view.
          Trigger grouping ("(...)") is accepted and ignored for playback.
        </p>
      </div>
    </div>
  );
}
