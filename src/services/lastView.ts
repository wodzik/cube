/**
 * Where you were on a tab — the practice/attack group (and folder), the
 * Academy lesson and step — so leaving the tab and coming back (or reloading)
 * puts you back there instead of on the default. Pages unmount when you
 * switch tabs, so this can't live in component state.
 *
 * Everything read back is validated against what exists NOW: a group or
 * subgroup that was deleted since (or an Attack subgroup that is no longer
 * Attack-enabled) is ignored and the page falls back to its default.
 */

import { ACADEMY_LESSONS } from "../data/academy";
import { getGroupMeta, isAttackAvailable } from "./algGroupRegistry";

export const PRACTICE_VIEW_KEY = "nact_last_view_practice";
export const ATTACK_VIEW_KEY = "nact_last_view_attack";
export const ACADEMY_VIEW_KEY = "nact_last_view_academy";

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable/full — the view just won't be remembered.
  }
}

// ─── group + subgroup (Drill Algorithms, Time Attack) ───

export interface GroupView {
  group: string;
  /** The open folder, if the group has subgroups and one was open. */
  subgroup: string | null;
}

export function loadGroupView(key: string, options: { attackOnly?: boolean } = {}): GroupView | null {
  const raw = readJson(key) as { group?: unknown; subgroup?: unknown } | null;
  if (!raw || typeof raw.group !== "string") return null;
  const meta = getGroupMeta(raw.group);
  if (!meta || (options.attackOnly && !isAttackAvailable(meta))) return null;
  let subgroup: string | null = null;
  if (typeof raw.subgroup === "string" && meta.hasSubgroups) {
    const found = meta.subgroups?.find((s) => s.id === raw.subgroup);
    if (found && (!options.attackOnly || found.availableInAttack === true)) subgroup = found.id;
  }
  return { group: meta.id, subgroup };
}

export function saveGroupView(key: string, group: string, subgroup: string | null): void {
  writeJson(key, { group, subgroup });
}

// ─── Academy lesson + step ───

export interface AcademyView {
  lesson: string;
  step: string;
}

export function loadAcademyView(): AcademyView | null {
  const raw = readJson(ACADEMY_VIEW_KEY) as { lesson?: unknown; step?: unknown } | null;
  if (!raw || typeof raw.lesson !== "string" || typeof raw.step !== "string") return null;
  const lesson = ACADEMY_LESSONS.find((l) => l.id === raw.lesson);
  const step = lesson?.steps.find((s) => s.id === raw.step);
  return lesson && step ? { lesson: lesson.id, step: step.id } : null;
}

export function saveAcademyView(lesson: string, step: string): void {
  writeJson(ACADEMY_VIEW_KEY, { lesson, step });
}
