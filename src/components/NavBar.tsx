/**
 * The header's tabs: a few top-level entries, the rest grouped in menus
 * (Practice ▾, Analyze ▾, ⚙ ▾) so the strip fits narrower screens. A group
 * lights up while you're on one of its pages (its menu marks which).
 *
 * Menus open as `fixed` popovers under their button — the strip scrolls
 * horizontally on phones (overflow), which would clip an absolute one.
 */

import { type ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown, GraduationCap, Settings } from "lucide-react";

export interface NavItem<T extends string> {
  id: T;
  label: string;
  /** Shown instead of the label on phones (the label from `sm` up). */
  icon?: ReactNode;
}

export interface NavEntry<T extends string> {
  /** A plain tab… */
  item?: NavItem<T>;
  /** …or a menu of tabs. */
  menu?: { label: ReactNode; title?: string; items: NavItem<T>[]; iconOnly?: boolean };
}

function Menu<T extends string>({ entry, tab, onSelect }: { entry: NonNullable<NavEntry<T>["menu"]>; tab: T; onSelect: (t: T) => void }) {
  const [open, setOpen] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = entry.items.find((i) => i.id === tab);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onResize = () => setOpen(null);
    // Scrolling (the tab strip on phones, or the page — the header stays put) keeps the menu under its button.
    const onScroll = () => {
      const button = buttonRef.current;
      if (button) setOpen(button.getBoundingClientRect());
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(open ? null : (buttonRef.current?.getBoundingClientRect() ?? null))}
        title={entry.title}
        aria-haspopup="menu"
        aria-expanded={!!open}
        className={`nav-tab flex items-center gap-1 ${current ? "nav-tab-active" : "nav-tab-inactive"} ${entry.iconOnly ? "!px-2.5" : ""}`}
      >
        {entry.label}
        {!entry.iconOnly && <ChevronDown size={13} className={`opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[60] min-w-44 p-1 rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl shadow-black/60 flex flex-col"
          style={{ top: open.bottom + 6, left: Math.max(8, Math.min(open.left, window.innerWidth - 184)) }}
        >
          {entry.items.map((i) => (
            <button
              key={i.id}
              role="menuitem"
              onClick={() => {
                onSelect(i.id);
                setOpen(null);
              }}
              className={`text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                i.id === tab ? "text-white bg-white/10" : "text-gray-400 hover:text-gray-100 hover:bg-white/5"
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function NavBar<T extends string>({ entries, tab, onSelect }: { entries: NavEntry<T>[]; tab: T; onSelect: (t: T) => void }) {
  return (
    <div className="nav-pill gap-0.5 sm:gap-1 w-max mx-auto">
      {entries.map((e, i) =>
        e.item ? (
          <button
            key={e.item.id}
            onClick={() => onSelect(e.item!.id)}
            title={e.item.icon ? e.item.label : undefined}
            className={`nav-tab flex items-center ${tab === e.item.id ? "nav-tab-active" : "nav-tab-inactive"}`}
          >
            {e.item.icon ? (
              <>
                <span className="sm:hidden">{e.item.icon}</span>
                <span className="hidden sm:inline">{e.item.label}</span>
              </>
            ) : (
              e.item.label
            )}
          </button>
        ) : e.menu ? (
          <Menu key={i} entry={e.menu} tab={tab} onSelect={onSelect} />
        ) : null
      )}
    </div>
  );
}

export const SettingsIcon = () => <Settings size={16} />;
export const AcademyIcon = () => <GraduationCap size={17} />;
