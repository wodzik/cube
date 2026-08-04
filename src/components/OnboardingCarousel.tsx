/**
 * OnboardingCarousel — Academy's beginner onboarding guide (see
 * data/onboarding.ts), rendered as normal in-page content (not a modal) so
 * it scrolls and reads like any other page. Chapters of slides, flattened
 * into one linear sequence for prev/next navigation; each slide shows
 * either ONE captioned, auto-looping, control-less cube demo (slide.demo)
 * or a GRID of several (slide.demos — e.g. all six face moves side by
 * side) alongside a short text explanation — same LoopingCubeDemo either
 * way, just one vs. many.
 *
 * Navigation: a top row of chapter/category pills (same visual pattern as
 * Practice/Attack's CFOP/ROUX/OTHER tabs — see GroupTabs) jumps straight to
 * a chapter's first slide; within a chapter, on-screen arrow buttons pinned
 * to the viewport's left/right edges, ArrowLeft/ArrowRight keys, a bottom
 * prev/next row, and a dot progress trail step through slides one at a
 * time. "Close" returns to the normal Academy lesson view.
 */

import { useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight, Hand } from "lucide-react";
import { LoopingCubeDemo } from "./LoopingCubeDemo";
import { VariantTest } from "./VariantTest";
import { ONBOARDING_CHAPTERS, type OnboardingSlide } from "../data/onboarding";
import type { DisplayConfig } from "../types/algorithm";

/** Cube preview settings for the "Try this" VariantTest popup — VariantTest only actually reads stickering/camera from this (visualization is hardcoded 3D there), so cardVisualization/cubeVisualization are unused filler to satisfy the type. */
const TRY_DISPLAY_CONFIG: DisplayConfig = {
  stickering: { kind: "named", value: "full" },
  cardVisualization: "3D",
  cubeVisualization: "3D",
  cameraLatitude: 20,
  cameraLongitude: 20,
};

interface OnboardingCarouselProps {
  onClose: () => void;
}

interface FlatSlide {
  chapterIndex: number;
  chapterTitle: string;
  slide: OnboardingSlide;
}

function flattenSlides(): FlatSlide[] {
  return ONBOARDING_CHAPTERS.flatMap((chapter, chapterIndex) =>
    chapter.slides.map((slide) => ({ chapterIndex, chapterTitle: chapter.title, slide }))
  );
}

export function OnboardingCarousel({ onClose }: OnboardingCarouselProps) {
  const flat = useMemo(flattenSlides, []);
  const chapterTabs = useMemo(
    () =>
      ONBOARDING_CHAPTERS.map((c, i) => ({
        id: c.id,
        title: c.title,
        firstIndex: flat.findIndex((f) => f.chapterIndex === i),
      })),
    [flat]
  );
  const [index, setIndex] = useState(0);
  const [showTry, setShowTry] = useState(false);

  const current = flat[index];
  const atStart = index === 0;
  const atEnd = index === flat.length - 1;

  const goNext = () => setIndex((i) => Math.min(i + 1, flat.length - 1));
  const goPrev = () => setIndex((i) => Math.max(i - 1, 0));

  useEffect(() => {
    setShowTry(false);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const demo = current?.slide.demo;

  if (!current) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6">
      {/* Edge arrow buttons, pinned to the viewport — hidden (not just disabled) at the very ends. */}
      {!atStart && (
        <button
          onClick={goPrev}
          title="Previous (←)"
          className="hidden lg:flex fixed left-3 top-1/2 -translate-y-1/2 p-3 rounded-full text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 transition-colors z-10"
        >
          <ChevronLeft size={28} />
        </button>
      )}
      {!atEnd && (
        <button
          onClick={goNext}
          title="Next (→)"
          className="hidden lg:flex fixed right-3 top-1/2 -translate-y-1/2 p-3 rounded-full text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 transition-colors z-10"
        >
          <ChevronRight size={28} />
        </button>
      )}

      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {chapterTabs.map((c, i) => (
            <button
              key={c.id}
              onClick={() => c.firstIndex >= 0 && setIndex(c.firstIndex)}
              className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide rounded-lg transition-colors shrink-0 ${
                current.chapterIndex === i
                  ? "text-white bg-white/[0.08]"
                  : "text-gray-600 hover:text-gray-300 hover:bg-white/[0.03]"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="btn-secondary text-xs shrink-0"
          title="Close the beginner's guide"
        >
          <X size={14} /> Close
        </button>
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">
          {current.chapterTitle} · {index + 1} / {flat.length}
        </p>
        <h2 className="text-white font-bold text-xl truncate">{current.slide.title}</h2>
      </div>

      <div className="py-2">
        {demo && (
          <div className="w-full max-w-64 mx-auto mb-3">
            <LoopingCubeDemo alg={demo.alg} setupAlg={demo.setupAlg} repeat={demo.repeat} label={demo.label ?? demo.alg} />
          </div>
        )}

        {demo && current.slide.tryOnCube && (
          <div className="flex justify-center mb-6">
            <button onClick={() => setShowTry(true)} className="btn-secondary text-xs">
              <Hand size={13} /> Try this
            </button>
            {showTry && (
              <VariantTest
                caseName={current.slide.title}
                variantName={demo.alg}
                alg={demo.alg}
                displayConfig={TRY_DISPLAY_CONFIG}
                onClose={() => setShowTry(false)}
              />
            )}
          </div>
        )}

        {current.slide.demos && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 mb-6">
            {current.slide.demos.map((d, i) => (
              <LoopingCubeDemo key={i} alg={d.alg} setupAlg={d.setupAlg} repeat={d.repeat} label={d.label} />
            ))}
          </div>
        )}

        <div className="space-y-3 max-w-3xl">
          {current.slide.paragraphs.map((p, i) => (
            <p key={i} className="text-sm text-gray-300 leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-4">
        <button
          onClick={goPrev}
          disabled={atStart}
          className="btn-secondary text-xs disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft size={14} /> Back
        </button>

        <div className="flex items-center gap-1 flex-wrap justify-center">
          {flat.map((f, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              title={f.slide.title}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-[var(--accent-bright)]" : "w-1.5 bg-white/15 hover:bg-white/30"
              }`}
            />
          ))}
        </div>

        {atEnd ? (
          <button onClick={onClose} className="btn-primary text-xs">
            Done
          </button>
        ) : (
          <button onClick={goNext} className="btn-secondary text-xs">
            Next <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
