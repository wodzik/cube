/**
 * GuidesIndex — the Academy's list of guides (data/guides), grouped into
 * the "learn to solve" path (in order) and reference pages, each as a card
 * with a looping cube preview.
 */

import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import type { Guide } from "../data/guides";
import { localizedGuides } from "../i18n/guideContent";
import { GuideCubeDemo } from "./GuideCubeDemo";
import { useT } from "../i18n/useT";

interface GuidesIndexProps {
  onOpen: (guideId: string) => void;
  /** Back to the Academy drill — omitted on the very first visit, when there's nothing to go back to yet. */
  onBack?: () => void;
}

function GuideCard({ guide, step, onOpen }: { guide: Guide; step?: number; onOpen: () => void }) {
  const { t } = useT();
  return (
    <button onClick={onOpen} className="panel p-5 text-left flex gap-5 hover:bg-white/[0.05] transition-colors group">
      <div className="w-24 sm:w-28 shrink-0">
        {guide.preview && <GuideCubeDemo demo={guide.preview} />}
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        {step !== undefined && <p className="text-[10px] font-bold text-[var(--accent-bright)] uppercase tracking-widest mb-1">{t("guides.partN", { n: step })}</p>}
        <h3 className="text-base font-bold text-white group-hover:text-[var(--accent-bright)] transition-colors">{guide.title}</h3>
        <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">{guide.tagline}</p>
        <p className="flex items-center gap-3 text-[11px] text-gray-600 mt-auto pt-3">
          <span className="flex items-center gap-1">
            <Clock size={11} /> {guide.readingTime}
          </span>
          <span className="flex items-center gap-1 ml-auto text-gray-500 group-hover:text-white transition-colors">
            {t("guides.open")} <ArrowRight size={12} />
          </span>
        </p>
      </div>
    </button>
  );
}

export function GuidesIndex({ onOpen, onBack }: GuidesIndexProps) {
  const { t, lang } = useT();
  const guides = localizedGuides(lang);
  const learn = guides.filter((g) => g.category === "learn");
  const reference = guides.filter((g) => g.category === "reference");
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-200 transition-colors mb-4">
          <ArrowLeft size={14} /> {t("guides.back")}
        </button>
      )}
      <h1 className="text-3xl font-extrabold tracking-tight text-white">{t("guides.title")}</h1>
      <p className="text-sm text-gray-400 mt-2 max-w-2xl">
        {t("guides.intro")}
      </p>

      <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-8 mb-3">{t("guides.learn")}</h2>
      <div className="grid gap-3">
        {learn.map((g, i) => (
          <GuideCard key={g.id} guide={g} step={i + 1} onOpen={() => onOpen(g.id)} />
        ))}
      </div>

      {reference.length > 0 && (
        <>
          <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-8 mb-3">{t("guides.reference")}</h2>
          <div className="grid gap-3">
            {reference.map((g) => (
              <GuideCard key={g.id} guide={g} onOpen={() => onOpen(g.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
