/**
 * GuidePage — renders one Academy guide (data/guides) as a single
 * scrolling page: title + intro, then every section in order, with a
 * sticky table of contents on wide screens that tracks the section
 * currently in view. Replaces the earlier slide carousel: a tutorial is
 * something you read, skim back through and jump around in, which a
 * scrolling page with anchors does and a deck of slides doesn't.
 *
 * Blocks (see GuideBlock) render as: paragraphs/lists with inline
 * notation (`R U R' U'`) and **bold**; callouts (tip / checkpoint /
 * warning / note, optionally with a picture); single demos and demo
 * grids; case cards (recognise → hold → algorithm, with a playable demo);
 * and buttons that jump into the Academy drill or to another guide.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, BookOpen, CheckCircle2, Clock, Dumbbell, Info, Lightbulb, TriangleAlert, X } from "lucide-react";
import { GuideCubeDemo } from "./GuideCubeDemo";
import type { Guide, GuideBlock, GuideCase, GuideDemo } from "../data/guides";
import { localizeGuide, localizedGuides, localizedGuideById } from "../i18n/guideContent";
import { useT } from "../i18n/useT";

interface GuidePageProps {
  guide: Guide;
  /** Back to the guides index. */
  onBack: () => void;
  /** Leave the guides entirely — back to the Academy drill. */
  onClose: () => void;
  onOpenGuide: (guideId: string) => void;
  onPractice: (lessonId: string, stepId: string) => void;
}

/** `code` → notation, **text** → bold. Nothing else — guide text is our own, not user input. */
export function renderInline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="font-mono text-[0.92em] px-1 py-0.5 rounded bg-white/[0.07] text-white whitespace-nowrap">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-gray-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

const CALLOUT_STYLE = {
  tip: { border: "border-sky-400/40", bg: "bg-sky-400/[0.06]", text: "text-sky-300", icon: Lightbulb, label: "guide.callout.tip" },
  checkpoint: { border: "border-emerald-400/40", bg: "bg-emerald-400/[0.06]", text: "text-emerald-300", icon: CheckCircle2, label: "guide.callout.checkpoint" },
  warning: { border: "border-amber-400/40", bg: "bg-amber-400/[0.06]", text: "text-amber-300", icon: TriangleAlert, label: "guide.callout.warning" },
  note: { border: "border-white/15", bg: "bg-white/[0.03]", text: "text-gray-300", icon: Info, label: "guide.callout.note" },
} as const;

function Callout({ tone, title, text, demo }: { tone: keyof typeof CALLOUT_STYLE; title?: string; text: string[]; demo?: GuideDemo }) {
  const { t } = useT();
  const s = CALLOUT_STYLE[tone];
  const Icon = s.icon;
  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} p-4 flex flex-col sm:flex-row gap-4`}>
      <div className="flex-1 min-w-0">
        <p className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${s.text} mb-1.5`}>
          <Icon size={13} /> {title ?? t(s.label)}
        </p>
        <div className="space-y-2">
          {text.map((t, i) => (
            <p key={i} className="text-sm text-gray-300 leading-relaxed">
              {renderInline(t)}
            </p>
          ))}
        </div>
      </div>
      {demo && <GuideCubeDemo demo={demo} className="w-40 sm:w-44 shrink-0 mx-auto sm:mx-0" />}
    </div>
  );
}

function CaseCard({ c }: { c: GuideCase }) {
  const { t } = useT();
  return (
    <div className="panel p-4 flex flex-col gap-2.5">
      <GuideCubeDemo demo={c.demo} tryTitle={c.name} />
      <div>
        <h4 className="text-sm font-bold text-white">{c.name}</h4>
        <p className="text-xs text-gray-400 leading-relaxed mt-1">{renderInline(c.recognise)}</p>
      </div>
      {c.hold && (
        <p className="text-xs text-gray-300 leading-relaxed">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mr-1.5">{t("guide.hold")}</span>
          {renderInline(c.hold)}
        </p>
      )}
      <p className="font-mono text-sm font-bold text-white tracking-tight break-words">{c.alg}</p>
      {c.note && <p className="text-[11px] text-gray-500 leading-relaxed">{renderInline(c.note)}</p>}
    </div>
  );
}

function Block({ block, onOpenGuide, onPractice }: { block: GuideBlock; onOpenGuide: GuidePageProps["onOpenGuide"]; onPractice: GuidePageProps["onPractice"] }) {
  const { lang } = useT();
  switch (block.kind) {
    case "p":
      return <p className="text-[15px] text-gray-300 leading-relaxed max-w-3xl">{renderInline(block.text)}</p>;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={`${block.ordered ? "list-decimal" : "list-disc"} pl-5 space-y-1.5 max-w-3xl`}>
          {block.items.map((item, i) => (
            <li key={i} className="text-[15px] text-gray-300 leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </Tag>
      );
    }
    case "callout":
      return <Callout tone={block.tone} title={block.title} text={block.text} demo={block.demo} />;
    case "demo":
      return (
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <GuideCubeDemo demo={block.demo} className="w-56 shrink-0 mx-auto sm:mx-0" />
          {block.caption && (
            <div className="space-y-2">
              {block.caption.map((t, i) => (
                <p key={i} className="text-sm text-gray-300 leading-relaxed">
                  {renderInline(t)}
                </p>
              ))}
            </div>
          )}
        </div>
      );
    case "demoGrid":
      return (
        <div className={`grid gap-4 ${block.columns === 2 ? "grid-cols-2 max-w-md" : "grid-cols-2 sm:grid-cols-3 max-w-2xl"}`}>
          {block.demos.map((d, i) => (
            <GuideCubeDemo key={i} demo={d} />
          ))}
        </div>
      );
    case "cases":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {block.cases.map((c) => (
            <CaseCard key={c.id} c={c} />
          ))}
        </div>
      );
    case "practice":
      return (
        <button onClick={() => onPractice(block.lessonId, block.stepId)} className="btn-primary text-xs w-fit">
          <Dumbbell size={14} /> {block.label}
        </button>
      );
    case "guideLink": {
      const target = localizedGuideById(block.guideId, lang);
      if (!target) return null;
      return (
        <button
          onClick={() => onOpenGuide(block.guideId)}
          className="flex items-center gap-3 text-left panel px-4 py-3 hover:bg-white/[0.05] transition-colors w-full max-w-xl"
        >
          <BookOpen size={16} className="text-[var(--accent-bright)] shrink-0" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white">{block.label}</span>
            {block.text && <span className="block text-xs text-gray-500 mt-0.5">{block.text}</span>}
          </span>
          <ArrowRight size={14} className="ml-auto text-gray-600 shrink-0" />
        </button>
      );
    }
  }
}

function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      // The active section is the last one whose top has scrolled past the
      // upper third of the viewport.
      const threshold = window.innerHeight / 3;
      let current: string | null = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(`guide-${id}`);
        if (el && el.getBoundingClientRect().top <= threshold) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);
  return active;
}

function scrollToSection(id: string) {
  document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function GuidePage({ guide: englishGuide, onBack, onClose, onOpenGuide, onPractice }: GuidePageProps) {
  const { t, lang } = useT();
  const guide = localizeGuide(englishGuide, lang);
  const GUIDES = localizedGuides(lang);
  const sectionIds = useMemo(() => guide.sections.map((s) => s.id), [guide]);
  const active = useActiveSection(sectionIds);
  const topRef = useRef<HTMLDivElement>(null);

  // A new guide starts at its top, not wherever the previous one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [guide.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  const index = GUIDES.findIndex((g) => g.id === guide.id);
  const prev = index > 0 ? GUIDES[index - 1] : null;
  const next = index >= 0 && index < GUIDES.length - 1 ? GUIDES[index + 1] : null;
  const activeSection = guide.sections.find((s) => s.id === active);

  return (
    <div ref={topRef} className="max-w-7xl mx-auto px-4 sm:px-8 pb-6">
      {/* Sticky guide bar, right under the app header: where you are, and
          the two ways out (up to the index, or out of the guides
          entirely). Stays put while the long page scrolls. */}
      <div className="sticky top-16 z-40 -mx-4 sm:-mx-8 px-4 sm:px-8 py-2 mb-4 bg-gray-950/85 backdrop-blur-xl border-b border-white/[0.06] flex items-center gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors shrink-0" title={t("guide.allGuides")}>
          <ArrowLeft size={14} /> {t("guide.guides")}
        </button>
        <span className="text-gray-700 text-xs shrink-0">/</span>
        <span className="text-xs font-semibold text-white truncate">{guide.title}</span>
        {activeSection && (
          <>
            <span className="hidden sm:inline text-gray-700 text-xs shrink-0">/</span>
            <span className="hidden sm:inline text-xs text-gray-500 truncate">
              {activeSection.eyebrow ? `${activeSection.eyebrow} · ` : ""}
              {activeSection.title}
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors" title={t("guide.top")}>
            <ArrowUp size={14} />
          </button>
          <button onClick={onClose} className="btn-secondary text-xs" title={t("guide.close")}>
            <X size={13} /> {t("common.close")}
          </button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden lg:block">
          <nav className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">{t("guide.contents")}</p>
            <ol className="space-y-0.5">
              {guide.sections.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => scrollToSection(s.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      active === s.id ? "bg-white/[0.08] text-white" : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.03]"
                    }`}
                  >
                    {s.eyebrow && <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-600">{s.eyebrow}</span>}
                    <span className="font-semibold">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0">
          <header className="mb-10">
            <div className="flex flex-col md:flex-row gap-6 md:items-start">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[var(--accent-bright)] uppercase tracking-widest mb-2">
                  {guide.category === "learn" ? t("guide.part", { n: index + 1 }) : t("guide.reference")}
                </p>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{guide.title}</h1>
                <p className="text-sm text-gray-400 mt-2 max-w-2xl">{guide.tagline}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="flex items-center gap-1 text-[11px] text-gray-500">
                    <Clock size={12} /> {guide.readingTime}
                  </span>
                  {guide.prerequisites?.map((id) => {
                    const p = localizedGuideById(id, lang);
                    return p ? (
                      <button key={id} onClick={() => onOpenGuide(id)} className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] text-gray-400 hover:text-white transition-colors">
                        {t("guide.before", { title: p.title })}
                      </button>
                    ) : null;
                  })}
                </div>
                <div className="space-y-3 mt-5 max-w-3xl">
                  {guide.intro.map((t, i) => (
                    <p key={i} className="text-[15px] text-gray-300 leading-relaxed">
                      {renderInline(t)}
                    </p>
                  ))}
                </div>
              </div>
              {guide.hero && <GuideCubeDemo demo={guide.hero} className="w-48 md:w-56 shrink-0 mx-auto md:mx-0" />}
            </div>

            {/* Compact contents for narrow screens (the sidebar is lg-only). */}
            <nav className="lg:hidden mt-6 flex flex-wrap gap-1.5">
              {guide.sections.map((s) => (
                <button key={s.id} onClick={() => scrollToSection(s.id)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/[0.04] text-gray-400 hover:text-white transition-colors">
                  {s.eyebrow ? `${s.eyebrow} · ` : ""}
                  {s.title}
                </button>
              ))}
            </nav>
          </header>

          <div className="space-y-14">
            {guide.sections.map((s) => (
              <section key={s.id} id={`guide-${s.id}`} className="scroll-mt-28">
                {s.eyebrow && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{s.eyebrow}</p>}
                <h2 className="text-2xl font-bold text-white tracking-tight mb-5">{s.title}</h2>
                <div className="space-y-5">
                  {s.blocks.map((b, i) => (
                    <Block key={i} block={b} onOpenGuide={onOpenGuide} onPractice={onPractice} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="mt-16 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row gap-3 sm:justify-between">
            {prev ? (
              <button onClick={() => onOpenGuide(prev.id)} className="btn-secondary text-xs">
                <ArrowLeft size={14} /> {prev.title}
              </button>
            ) : (
              <span />
            )}
            {next && (
              <button onClick={() => onOpenGuide(next.id)} className="btn-secondary text-xs">
                {next.title} <ArrowRight size={14} />
              </button>
            )}
          </footer>
        </article>
      </div>
    </div>
  );
}
