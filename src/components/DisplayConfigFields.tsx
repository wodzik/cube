/**
 * DisplayConfigFields — visualization / camera / stickering editor for a
 * DisplayConfig. Shared by GroupSettingsModal (group/subgroup level) and
 * CaseEdit's Advanced section (per-case override) so both edit the exact
 * same set of fields the exact same way.
 */

import { useState } from "react";
import type { DisplayConfig, StickeringConfig } from "../types/algorithm";
import type { VisualizationMode } from "../types/cube";
import { MaskPicker } from "./MaskPicker";

interface DisplayConfigFieldsProps {
  config: DisplayConfig;
  onChange: (next: DisplayConfig) => void;
}

const VISUALIZATIONS: { id: VisualizationMode; label: string }[] = [
  { id: "3D", label: "3D" },
  { id: "2D", label: "2D (flat net)" },
  { id: "experimental-2D-LL", label: "2D last layer" },
];

const NAMED_PRESETS = ["full", "OLL", "PLL", "F2L", "CLL", "ELL", "COLL", "WV", "VLS", "ZBLL", "OLLCP"];

const inputClass =
  "w-full bg-gray-950/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors";

export function DisplayConfigFields({ config, onChange }: DisplayConfigFieldsProps) {
  const [useMask, setUseMask] = useState(config.stickering.kind === "mask");

  const setStickering = (stickering: StickeringConfig) => onChange({ ...config, stickering });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-400 mb-1.5">Card visualization</p>
        <p className="text-[11px] text-gray-600 mb-1.5">Shown on the compact case/subgroup cards in the list.</p>
        <div className="flex gap-1.5">
          {VISUALIZATIONS.map((v) => (
            <button
              key={v.id}
              onClick={() => onChange({ ...config, cardVisualization: v.id })}
              className={`flex-1 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                config.cardVisualization === v.id
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
        <p className="text-xs font-semibold text-gray-400 mb-1.5">Cube preview visualization</p>
        <p className="text-[11px] text-gray-600 mb-1.5">Shown on the big cube during practice/editing.</p>
        <div className="flex gap-1.5">
          {VISUALIZATIONS.map((v) => (
            <button
              key={v.id}
              onClick={() => onChange({ ...config, cubeVisualization: v.id })}
              className={`flex-1 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                config.cubeVisualization === v.id
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
              value={config.cameraLatitude}
              onChange={(e) => onChange({ ...config, cameraLatitude: Number(e.target.value) })}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="flex-1 text-[11px] text-gray-500">
            Longitude
            <input
              type="number"
              value={config.cameraLongitude}
              onChange={(e) => onChange({ ...config, cameraLongitude: Number(e.target.value) })}
              className={`${inputClass} mt-1`}
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
                setStickering({ kind: "named", value: config.stickering.kind === "named" ? config.stickering.value : "full" });
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
                setStickering(config.stickering.kind === "mask" ? config.stickering : { kind: "mask", pieceGroups: [] });
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
                  config.stickering.kind === "named" && config.stickering.value === p
                    ? "text-white bg-white/[0.08]"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                }`}
                style={
                  config.stickering.kind === "named" && config.stickering.value === p
                    ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" }
                    : undefined
                }
              >
                {p}
              </button>
            ))}
            <input
              type="text"
              value={config.stickering.kind === "named" ? config.stickering.value : ""}
              onChange={(e) => setStickering({ kind: "named", value: e.target.value })}
              placeholder="or type a scheme"
              className={`${inputClass} flex-1 min-w-[8rem]`}
            />
          </div>
        ) : (
          <MaskPicker
            value={config.stickering.kind === "mask" ? config.stickering : { kind: "mask", pieceGroups: [] }}
            onChange={setStickering}
          />
        )}
      </div>
    </div>
  );
}
