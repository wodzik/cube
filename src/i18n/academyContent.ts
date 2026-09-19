/**
 * Language-aware view of the Academy lessons: the English data from
 * data/academy.ts with the Polish overlay (academy.pl.ts) applied to text
 * fields only. Ids, algorithms, masks and order are untouched, so selection
 * storage and drills behave identically in both languages. A missing Polish
 * field falls back to the English one.
 */

import { ACADEMY_LESSONS, type AcademyLesson } from "../data/academy";
import { ACADEMY_PL } from "./academy.pl";
import type { Lang } from "./i18n";

export function localizeLesson(lesson: AcademyLesson, lang: Lang): AcademyLesson {
  if (lang === "en") return lesson;
  const pl = ACADEMY_PL[lesson.id];
  if (!pl) return lesson;
  return {
    ...lesson,
    title: pl.title ?? lesson.title,
    description: pl.description ?? lesson.description,
    steps: lesson.steps.map((step) => {
      const s = pl.steps[step.id];
      if (!s) return step;
      return {
        ...step,
        title: s.title ?? step.title,
        description: s.description ?? step.description,
        algs: step.algs.map((alg) => {
          const a = s.algs[alg.id];
          return a ? { ...alg, name: a.name ?? alg.name, description: a.description ?? alg.description } : alg;
        }),
      };
    }),
  };
}

const cache = new Map<Lang, AcademyLesson[]>();

/** All lessons in `lang` (memoised per language, so identity is stable between renders). */
export function localizedLessons(lang: Lang): AcademyLesson[] {
  let lessons = cache.get(lang);
  if (!lessons) {
    lessons = ACADEMY_LESSONS.map((l) => localizeLesson(l, lang));
    cache.set(lang, lessons);
  }
  return lessons;
}
