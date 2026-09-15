/**
 * CompactRecentList — a narrow, always-visible preview of a "recent items"
 * list (solves, attack sessions, ...) for the dedicated left sidebar column
 * (TrainLayout's `leftAside` slot), with an expand icon (the same one the
 * stats chart uses) that opens the page's full table (sort controls,
 * pagination, row actions, every column) in the shared OverlayModal popup
 * — the same popup the chart opens into, so both "see more" gestures look
 * and close the same way. The narrow preview itself never changes size.
 *
 * Generic over the row type so each page keeps its own row shape (SolvePage:
 * solve number + time; AttackPage: session date + case count + time; ...).
 */

import type { ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import { OverlayModal } from "./OverlayModal";

interface CompactRecentListProps<T> {
  title: string;
  items: readonly T[];
  keyOf: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  expanded: boolean;
  onToggleExpand: () => void;
  /** The page's full table — rendered only inside the popup while `expanded`. */
  expandedContent: ReactNode;
  /** Extra classes on the (always narrow) root, e.g. its fixed width at the `lg` breakpoint. */
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
  if (items.length === 0) return null;

  return (
    <>
      {/* h-full: the wrapping leftAside column runs the full page height (see
          TrainLayout); max-h caps that at the viewport instead of letting
          `h-full` resolve against an indefinite ancestor — with enough items
          the rows below would otherwise have no bound to scroll against and
          this list's own height would drag the whole row (and the cube/timer
          centered within it) off the bottom of the screen. */}
      <div className={`flex flex-col min-h-0 h-full max-h-[calc(100vh-8rem)] ${className}`}>
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{title}</h3>
          <button
            onClick={onToggleExpand}
            title="Show all"
            className="p-1 rounded-md text-gray-600 hover:text-gray-200 hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <Maximize2 size={13} />
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          {items.map((item) => (
            <div key={keyOf(item)}>{renderRow(item)}</div>
          ))}
        </div>
      </div>

      {expanded && (
        <OverlayModal
          onClose={onToggleExpand}
          // Near-fullscreen (matches the chart's own fullscreen) — this is a
          // full session log, not a small lookup popup, so it should read as
          // its own page rather than a dialog floating over the app.
          className="w-[97vw] h-[95vh]"
          bodyClassName="p-5 flex flex-col min-h-0"
          header={<h3 className="text-xs font-semibold text-gray-300 uppercase tracking-widest">{title}</h3>}
        >
          {expandedContent}
        </OverlayModal>
      )}
    </>
  );
}
