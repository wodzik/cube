/**
 * Translated labels for enum-like values that are stored/compared in English
 * (category ids, learning statuses). The stored value never changes — only
 * what is displayed.
 */

import { t } from "./i18n";
import type { LearningStatus } from "../types/algorithm";

/** CFOP and Roux are method names and stay as they are; "Other" is translated. */
export function categoryLabel(category: string): string {
  return category === "Other" ? t("category.misc") : category;
}

export function learningStatusLabel(status: LearningStatus): string {
  return t(status === "not-started" ? "status.notStarted" : status === "learning" ? "status.learning" : "status.learned");
}

const PIECE_GROUP_KEYS: Record<string, Parameters<typeof t>[0]> = {
  "u-edges": "mask.group.uEdges",
  "u-corners": "mask.group.uCorners",
  "d-edges": "mask.group.dEdges",
  "d-corners": "mask.group.dCorners",
};

/** Mask piece-group chips; the F2L slot chips ("F2L FR") keep their method-term label. */
export function pieceGroupLabel(group: { id: string; label: string }): string {
  const key = PIECE_GROUP_KEYS[group.id];
  return key ? t(key) : group.label;
}

const CENTER_KEYS: Record<string, Parameters<typeof t>[0]> = {
  "center-u": "mask.center.u",
  "center-l": "mask.center.l",
  "center-f": "mask.center.f",
  "center-r": "mask.center.r",
  "center-b": "mask.center.b",
  "center-d": "mask.center.d",
};

export function centerGroupLabel(group: { id: string; label: string }): string {
  const key = CENTER_KEYS[group.id];
  return key ? t(key) : group.label;
}
