/**
 * CompactRecentList — a narrow, always-visible preview of a "recent items"
 * list (solves, attack sessions, ...) for the dedicated left sidebar column
 * (TrainLayout's `leftAside` slot), with a button that expands the page's
 * full table (sort controls, pagination, row actions, every column) as a
 * fixed-position OVERLAY on top of the page — not by growing this column in
 * flow, which would shift the cube/timer/chart columns beside it. The
 * narrow preview itself never changes size or disappears; the overlay is
 * purely additive, closed by its own close button, the Escape key, or
 * clicking the backdrop.
 *
 * Generic over the row type so each page keeps its own row shape (SolvePage:
 * solve number + time; AttackPage: session date + case count + time; ...).
 */

import { useEffect } from "react";
import type { ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";

interface CompactRecentListProps<T> {
  title: string;
  items: readonly T[];
  keyOf: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  expanded: boolean;
  onToggleExpand: () => void;
  /** The page's full table — rendered only inside the overlay while `expanded`. */
  expandedContent: ReactNode;
  /** Extra classes on the (always narrow) root panel, e.g. its fixed width at the `lg` breakpoint. */
  className?: string;
}

export function CompactRecentList<T>({
  title,
  items,
  keyOf,
  renderRow,
  expanded,
  onToggleExpand,
  expandedContent,
  className = "",
}: CompactRecentListProps<T>) {
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggleExpand();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, onToggleExpand]);

  if (items.length === 0) return null;

  return (
    <>
      {/* h-full: the wrapping leftAside column runs the full page height (see
          TrainLayout) — without h-full here this card would size to its rows
          and leave a chunk of bare column below it instead of reading as one
          continuous panel. max-h caps that at the viewport instead of letting
          `h-full` resolve against an indefinite ancestor: with enough items
          the rows below would otherwise have no bound to scroll against
          (percentage heights on an auto-sized flex ancestor compute as
          "auto"), so this panel's own hypothetical height became "however
          tall every row is" — which then dragged the WHOLE row's stretched
          height (and the cube/timer column centered within it) down with it,
          off the bottom of the screen. */}
      <div className={`panel p-4 flex flex-col min-h-0 h-full max-h-[calc(100vh-8rem)] ${className}`}>
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{title}</h3>
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-gray-200 transition-colors shrink-0"
          >
            Show all
            <ChevronDown size={12} />
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col divide-y divide-gray-800/40 overflow-y-auto">
          {items.map((item) => (
            <div key={keyOf(item)}>{renderRow(item)}</div>
          ))}
        </div>
      </div>

      {expanded && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onToggleExpand} />
          <div className="fixed inset-y-0 left-0 z-50 w-full sm:w-[28rem] xl:w-[32rem] bg-gray-900/95 backdrop-blur-xl border-r border-white/10 shadow-2xl shadow-black/60 flex flex-col p-4 overflow-y-auto">
            <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-widest">{title}</h3>
              <button onClick={onToggleExpand} className="p-1.5 text-gray-500 hover:text-white transition-colors" title="Close">
                <X size={16} />
              </button>
            </div>
            {expandedContent}
          </div>
        </>
      )}
    </>
  );
}
