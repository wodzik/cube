/**
 * TryAlgorithmPanel — Debug page's second tab: paste any algorithm and
 * watch it performed on a live TwistyPlayer (its own built-in play/pause/
 * step/scrub controls — see controlPanel="bottom-row" below), no scramble
 * or session involved. Useful for eyeballing whether a pasted/scraped
 * algorithm's notation is actually valid and does what it's supposed to.
 *
 * Two independent options beyond the raw algorithm text:
 *  - "Setup moves": a prefix applied to the cube BEFORE the algorithm,
 *    exactly as written (not inverted) — e.g. paste a scramble here to see
 *    whether a solution algorithm actually solves it.
 *  - "This algorithm solves the cube": OFF (default) plays the algorithm
 *    forward from solved (+ any setup moves), same as before. ON treats the
 *    pasted text as a SOLUTION — the setup additionally gets that
 *    algorithm's own inverse stacked on top (same buildCaseSetupAlg
 *    convention used by case practice, see moveParser.ts).
 *
 * Either way, a leading rotation in the typed Algorithm (e.g. "y U2 ...")
 * is always moved out of the animated part — TwistyPlayer silently ignores
 * a rotation-only move sitting at index 0 of its `alg` timeline (verified
 * live). In OFF mode it's relocated into `setup` unchanged. In ON mode it's
 * simply dropped rather than relocated — invertSequence(rest) naturally
 * reintroduces it as a leading setup token anyway whenever the algorithm
 * already ends with its own opposite rotation (a common PLL/OLL data
 * convention, e.g. "x R' U R2 ... x'"); explicitly re-adding it on top of
 * that double-applies the rotation and visibly desyncs the display
 * (reported live, then reverted).
 *
 * TwistyPlayer's `alg`/`setupAlg` are effectively write-once-at-mount (see
 * CubeVisualisation's own doc comment) — live updates go through the
 * imperative ref, same pattern as AlgCaseVisualisation. Also passed as
 * props so a stickering-channel remount (named <-> mask, see
 * CubeVisualisation's internal remount effect) picks up the CURRENT
 * setup/alg instead of resetting to blank.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { CubeVisualisation, type CubeVisualisationRef } from "./CubeVisualisation";
import { MaskPicker } from "./MaskPicker";
import { parseMove, stripLeadingRotations, invertSequence } from "../logic/moveParser";
import { parseDecoratedAlg } from "../data/academy";
import { resolveStickeringProps } from "../services/algGroupRegistry";
import type { StickeringConfig } from "../types/algorithm";
import type { VisualizationMode } from "../types/cube";

const VISUALIZATIONS: { id: VisualizationMode; label: string }[] = [
  { id: "3D", label: "3D" },
  { id: "2D", label: "2D (flat net)" },
  { id: "experimental-2D-LL", label: "2D last layer" },
];

const NAMED_PRESETS = ["full", "OLL", "PLL", "F2L", "CLL", "ELL", "COLL", "WV", "VLS", "ZBLL", "OLLCP"];

const inputClass =
  "w-full bg-gray-950/60 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors";

function tokenizeAndValidate(text: string): { tokens: string[]; invalid: string[] } {
  const { tokens } = parseDecoratedAlg(text);
  return { tokens, invalid: tokens.filter((t) => !parseMove(t)) };
}

export function TryAlgorithmPanel() {
  const [algInput, setAlgInput] = useState("");
  const [setupInput, setSetupInput] = useState("");
  const [solvesTheCube, setSolvesTheCube] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [visualization, setVisualization] = useState<VisualizationMode>("3D");
  const [cameraLatitude, setCameraLatitude] = useState(20);
  const [cameraLongitude, setCameraLongitude] = useState(20);
  const [stickering, setStickering] = useState<StickeringConfig>({ kind: "named", value: "full" });
  const [useMask, setUseMask] = useState(false);
  const cubeRef = useRef<CubeVisualisationRef>(null);

  const { tokens: algTokens, invalid: invalidAlgTokens } = useMemo(() => tokenizeAndValidate(algInput), [algInput]);
  const { tokens: setupTokens, invalid: invalidSetupTokens } = useMemo(() => tokenizeAndValidate(setupInput), [setupInput]);
  const hasErrors = invalidAlgTokens.length > 0 || invalidSetupTokens.length > 0;

  const { setup, alg } = useMemo(() => {
    if (hasErrors) return { setup: "", alg: "" };
    const manualSetup = setupTokens.join(" ");

    // TwistyPlayer silently ignores a rotation-only move sitting at index 0
    // of its animated `alg` timeline (verified live: pasting "y U2 (L U'
    // L') U (S' L' S)" directly into Algorithm showed the first VISIBLE
    // move as U2, as if the leading y had never been typed). A leading
    // rotation in the typed Algorithm must never be the first token of
    // `alg` — move it into `setup` instead (a one-shot state, not an
    // animated step, so it has no such issue).
    const playedTokens = stripLeadingRotations(algTokens);
    const leadingRotation = algTokens.slice(0, algTokens.length - playedTokens.length).join(" ");

    if (!solvesTheCube) {
      const combinedSetup = [manualSetup, leadingRotation].filter(Boolean).join(" ");
      return { setup: combinedSetup, alg: playedTokens.join(" ") };
    }
    // Same convention as case practice (buildCaseSetupAlg): drop the
    // leading rotation and invert the rest — do NOT also re-prepend
    // `leadingRotation` here. Plenty of scraped algorithms already end
    // with their OWN opposite rotation (e.g. "x R' U R2 ... x'", common in
    // PLL/OLL data, written so the algorithm restores orientation at the
    // end) — invertSequence naturally turns that trailing rotation into a
    // leading one in the result, and re-prepending on top of THAT applied
    // the rotation twice, visibly desyncing the display (reported live).
    // Dropping it outright and letting invertSequence do its own thing is
    // correct either way: an algorithm with no trailing rotation of its
    // own just loses the leading one entirely (same tradeoff
    // buildCaseSetupAlg already accepts), and one that already has a
    // trailing rotation gets it back for free, exactly once.
    const caseSetup = playedTokens.length === 0 ? "" : invertSequence(playedTokens).join(" ");
    const combinedSetup = [manualSetup, caseSetup].filter(Boolean).join(" ");
    return { setup: combinedSetup, alg: playedTokens.join(" ") };
  }, [hasErrors, setupTokens, algTokens, solvesTheCube]);

  useEffect(() => {
    cubeRef.current?.setSetupAlgorithm(setup, alg, "start");
  }, [setup, alg]);

  function clearAll() {
    setAlgInput("");
    setSetupInput("");
  }

  const stickeringProps = resolveStickeringProps(stickering);

  return (
    <div className="flex flex-1 min-h-0 overflow-y-auto">
      <div className="flex-none w-72 xl:w-96 border-r border-white/[0.06] flex items-center justify-center p-6 self-start">
        <div className="w-full aspect-square bg-gray-950/50 rounded-xl overflow-hidden">
          <CubeVisualisation
            ref={cubeRef}
            visualization={visualization}
            background="none"
            controlPanel="bottom-row"
            dragInput="auto"
            hintFacelets="floating"
            tempoScale={1}
            cameraLatitude={cameraLatitude}
            cameraLongitude={cameraLongitude}
            setupAlg={setup}
            alg={alg}
            {...stickeringProps}
            className="size-full"
          />
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 py-4 max-w-2xl">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Setup moves</label>
        <input
          type="text"
          value={setupInput}
          onChange={(e) => setSetupInput(e.target.value)}
          placeholder="Optional — moves applied before the algorithm, e.g. a scramble"
          spellCheck={false}
          className={inputClass}
        />
        {invalidSetupTokens.length > 0 && (
          <p className="text-xs text-red-400 mt-1.5">Not valid cube notation: {invalidSetupTokens.join(" ")}</p>
        )}

        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 mt-4">Algorithm</label>
        <textarea
          value={algInput}
          onChange={(e) => setAlgInput(e.target.value)}
          placeholder="e.g. R U R' U' R' F R2 U' R' U' R U R' F'"
          rows={3}
          spellCheck={false}
          className={`${inputClass} resize-none`}
        />
        {invalidAlgTokens.length > 0 && (
          <p className="text-xs text-red-400 mt-1.5">Not valid cube notation: {invalidAlgTokens.join(" ")}</p>
        )}

        <label className="flex items-center gap-2 mt-3 text-xs text-gray-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={solvesTheCube}
            onChange={(e) => setSolvesTheCube(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          This algorithm solves the cube (start scrambled, end solved — instead of starting solved)
        </label>

        <div className="flex items-center gap-2 mt-3">
          <button onClick={clearAll} disabled={!algInput && !setupInput} className="btn-secondary text-xs">
            <RotateCcw size={12} /> Clear
          </button>
        </div>

        <button
          onClick={() => setDisplayOpen((v) => !v)}
          className="flex items-center gap-1 mt-5 text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors"
        >
          {displayOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          Display: visualization, camera, stickering
        </button>

        {displayOpen && (
          <div className="mt-3 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">Visualization</p>
              <div className="flex gap-1.5">
                {VISUALIZATIONS.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVisualization(v.id)}
                    className={`flex-1 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      visualization === v.id
                        ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.08] text-white"
                        : "border-white/[0.06] bg-white/[0.02] text-gray-300 hover:border-white/15"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">Camera angle</p>
              <div className="flex gap-2">
                <label className="flex-1 text-[11px] text-gray-500">
                  Latitude
                  <input
                    type="number"
                    value={cameraLatitude}
                    onChange={(e) => setCameraLatitude(Number(e.target.value))}
                    className={`${inputClass} mt-1 py-1.5`}
                  />
                </label>
                <label className="flex-1 text-[11px] text-gray-500">
                  Longitude
                  <input
                    type="number"
                    value={cameraLongitude}
                    onChange={(e) => setCameraLongitude(Number(e.target.value))}
                    className={`${inputClass} mt-1 py-1.5`}
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-gray-400">Stickering</p>
                <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.03] p-0.5">
                  <button
                    onClick={() => {
                      setUseMask(false);
                      setStickering((s) => (s.kind === "named" ? s : { kind: "named", value: "full" }));
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                      !useMask ? "text-white bg-white/[0.1]" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Named
                  </button>
                  <button
                    onClick={() => {
                      setUseMask(true);
                      setStickering((s) => (s.kind === "mask" ? s : { kind: "mask", pieceGroups: [] }));
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                      useMask ? "text-white bg-white/[0.1]" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Mask
                  </button>
                </div>
              </div>

              {!useMask ? (
                <div className="flex flex-wrap gap-1.5">
                  {NAMED_PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setStickering({ kind: "named", value: p })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        stickering.kind === "named" && stickering.value === p
                          ? "text-white bg-white/[0.08]"
                          : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                      }`}
                      style={
                        stickering.kind === "named" && stickering.value === p
                          ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" }
                          : undefined
                      }
                    >
                      {p}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={stickering.kind === "named" ? stickering.value : ""}
                    onChange={(e) => setStickering({ kind: "named", value: e.target.value })}
                    placeholder="or type a scheme"
                    className={`${inputClass} flex-1 min-w-[8rem] py-1.5`}
                  />
                </div>
              ) : (
                <MaskPicker
                  value={stickering.kind === "mask" ? stickering : { kind: "mask", pieceGroups: [] }}
                  onChange={setStickering}
                />
              )}
            </div>
          </div>
        )}

        <p className="text-[11px] text-gray-600 mt-4">
          Press play or step through the moves with the controls under the cube. Drag the cube to change the view.
          Trigger grouping ("(...)") is accepted and ignored for playback.
        </p>
      </div>
    </div>
  );
}
