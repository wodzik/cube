/**
 * The small uppercase name of a page ("SPEED SOLVE", "TRAINERS"…) — the same
 * on every page: TrainerPanel pages get it through their `title`, the others
 * put it first in their content.
 */

import type { ReactNode } from "react";

export function PageLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`text-xs font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap shrink-0 ${className}`}>{children}</span>;
}
