/**
 * OverlayModal — the ONE popup shell for "open this bigger" views (the
 * fullscreen stats chart, the full recent-times table), so every such
 * popup looks and behaves the same: centered card over a dimmed backdrop,
 * a header row (caller-provided content + close button), closed by the
 * close button, the Escape key, or clicking the backdrop.
 */

import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "../i18n/useT";

interface OverlayModalProps {
  onClose: () => void;
  /** Left side of the header row (title, chips, controls). */
  header?: ReactNode;
  /** Size classes for the card, e.g. "w-[97vw] h-full" or "w-[min(97vw,40rem)] max-h-full" — NOT vh heights: on a phone `vh` ignores the browser toolbars, so a centered card taller than the visible area loses its header (and close button) off the top. */
  className?: string;
  /** Extra classes on the scrollable body (defaults to padded + vertical scroll). */
  bodyClassName?: string;
  children: ReactNode;
}

export function OverlayModal({ onClose, header, className = "", bodyClassName = "p-5 overflow-y-auto", children }: OverlayModalProps) {
  const { t } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3" onClick={onClose}>
      <div
        className={`bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden max-h-full ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 shrink-0">
          <div className="flex items-center gap-1 min-w-0">{header}</div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-200 transition-colors shrink-0" title={t("common.close")}>
            <X size={18} />
          </button>
        </div>
        <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
      </div>
    </div>
  );
}
