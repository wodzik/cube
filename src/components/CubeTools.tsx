/**
 * What concerns the cube itself, under the 3D view: turn arrows (the next
 * move of the scramble / algorithm drawn on the cube) and "Mark as solved"
 * (the app keeps the smart cube's state across pages — this is how to tell
 * it the cube is solved). Shown while a smart cube is connected.
 */

import { useState } from "react";
import { CheckCheck, Navigation } from "lucide-react";
import { useSmartCubeConnection } from "../hooks/useSmartCube";
import { useTurnArrows } from "../hooks/useTurnArrows";

export function CubeTools({ arrows: withArrows = true }: { arrows?: boolean }) {
  const conn = useSmartCubeConnection();
  const { arrows, toggleArrows } = useTurnArrows();
  const [marked, setMarked] = useState(false);
  if (!conn?.session) return null;
  const btn = "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors";
  return (
    <>
      {withArrows && (
        <button
          onClick={toggleArrows}
          className={`${btn} ${arrows ? "text-sky-300 bg-sky-500/10" : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"}`}
          title={arrows ? "Hide the turn arrows" : "Show the next turn as arrows on the cube"}
        >
          <Navigation size={12} /> Arrows: {arrows ? "on" : "off"}
        </button>
      )}
      <button
        onClick={() => {
          conn.markSolved();
          setMarked(true);
          setTimeout(() => setMarked(false), 1500);
        }}
        className={`${btn} ${marked ? "text-emerald-300 bg-emerald-500/10" : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"}`}
        title={
          conn.session.info.capabilities.reset
            ? "My cube is solved — track it from solved (scrambles and targets are planned again); the cube resets its own state too, so it connects as solved next time"
            : "My cube is solved — track it from solved (scrambles and targets are planned again). This cube can't reset its own state, so the app remembers it and reads the cube that way on every connection"
        }
      >
        <CheckCheck size={12} /> {marked ? "Marked solved" : "Mark as solved"}
      </button>
    </>
  );
}
