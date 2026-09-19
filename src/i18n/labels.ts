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
