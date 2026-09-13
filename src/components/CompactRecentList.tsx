/**
 * CompactRecentList — a narrow, always-visible preview of a "recent items"
 * list (solves, attempts, sessions, ...) for the stats sidebar column, with
 * a button to expand into that page's existing full table instead (sort
 * controls, pagination, row actions — whatever the caller already renders
 * elsewhere). This component owns only the compact preview; the caller
 * still owns and renders the full table itself, gated on `expanded`.
 *
 * Generic over the row type so each page keeps its own row shape (SolvePage:
 * solve number + time; a case trainer: case name + time + accuracy; ...) —
 * this only supplies the scrollable shell, title, and expand/collapse
 * button.
 */

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CompactRecentListProps<T> {
  title: string;
  items: readonly T[];
  keyOf: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  expanded: boolean;
  onToggleExpand: () => void;
  /** Collapsed-state scroll cap, in rows-worth of height — older items scroll rather than growing the sidebar unboundedly. */
  maxVisibleRows?: number;
}

export function CompactRecentList<T>({
  title,
  items,
  keyOf,
  renderRow,
  expanded,
  onToggleExpand,
  maxVisibleRows = 10,
}: CompactRecentListProps<T>) {
  if (items.length === 0) return null;

  return (
    <div className="panel p-4 flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{title}</h3>
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-gray-200 transition-colors"
        >
          {expanded ? "Collapse" : "Show all"}
          <ChevronDown size={12} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>
      {!expanded && (
        <div className="flex flex-col divide-y divide-gray-800/40 overflow-y-auto" style={{ maxHeight: `${maxVisibleRows * 2}rem` }}>
          {items.map((item) => (
            <div key={keyOf(item)}>{renderRow(item)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
