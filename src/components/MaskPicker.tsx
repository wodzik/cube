/**
 * MaskPicker — composable stickering-mask editor: toggle any number of
 * predefined piece-groups (an F2L slot, "top-layer edges", …) to union them
 * into one mask, or drop into a raw JSON override for anything the presets
 * can't express. Used by GroupSettingsModal (group/subgroup level) and
 * CaseEdit's Advanced section (per-case override).
 */

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MASK_PIECE_GROUPS, buildMaskFromPieceGroups } from "../logic/maskPieceGroups";
import type { StickeringConfig } from "../types/algorithm";

type MaskConfig = Extract<StickeringConfig, { kind: "mask" }>;

interface MaskPickerProps {
  value: MaskConfig;
  onChange: (next: MaskConfig) => void;
}

export function MaskPicker({ value, onChange }: MaskPickerProps) {
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(value.rawOverride));
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(value.rawOverride ?? buildMaskFromPieceGroups(value.pieceGroups), null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const toggle = (id: string) => {
    const next = value.pieceGroups.includes(id)
      ? value.pieceGroups.filter((x) => x !== id)
      : [...value.pieceGroups, id];
    onChange({ ...value, pieceGroups: next });
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonError(null);
      onChange({ ...value, rawOverride: parsed });
    } catch {
      setJsonError("Not valid JSON.");
    }
  };

  const clearOverride = () => {
    setJsonError(null);
    setJsonText(JSON.stringify(buildMaskFromPieceGroups(value.pieceGroups), null, 2));
    onChange({ ...value, rawOverride: undefined });
  };

  return (
    <div>
      <div className={`flex flex-wrap gap-1.5 ${value.rawOverride ? "opacity-40 pointer-events-none" : ""}`}>
        {MASK_PIECE_GROUPS.map((g) => {
          const active = value.pieceGroups.includes(g.id);
          return (
            <button
              key={g.id}
              onClick={() => toggle(g.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                active ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
              }`}
              style={active ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined}
            >
              {g.label}
            </button>
          );
        })}
        {value.pieceGroups.length === 0 && !value.rawOverride && (
          <p className="text-[11px] text-gray-600 self-center">Pick at least one, or use the JSON override below.</p>
        )}
      </div>

      <button
        onClick={() => setAdvancedOpen((v) => !v)}
        className="flex items-center gap-1 mt-3 text-[11px] font-semibold text-gray-500 hover:text-gray-300 transition-colors"
      >
        {advancedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Advanced: edit mask JSON{value.rawOverride ? " (active)" : ""}
      </button>

      {advancedOpen && (
        <div className="mt-2 space-y-2">
          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setJsonError(null);
            }}
            rows={8}
            className="w-full bg-gray-950/60 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-[var(--accent)] transition-colors"
            spellCheck={false}
          />
          {jsonError && <p className="text-[11px] text-red-400">{jsonError}</p>}
          <div className="flex gap-2">
            <button onClick={applyJson} className="btn-secondary text-xs">
              Apply override
            </button>
            {value.rawOverride && (
              <button onClick={clearOverride} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Clear override (use chips above)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
