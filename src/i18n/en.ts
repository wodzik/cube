/**
 * English messages — the source of truth for `MessageKey`. Add a key here,
 * then its Polish text in pl.ts (the compiler insists). Keep keys grouped by
 * the area that shows them; `{name}` placeholders are filled from `t`'s params.
 */

export const en = {
  // ─── Navigation / chrome ───
  "nav.solve": "Solve",
  "nav.training": "Drill Algorithms",
  "nav.trainer": "Skill Trainers",
  "nav.attack": "Time Attack",
  "nav.academy": "Academy",
  "nav.debug": "Debug",
  "nav.settings": "Settings",
  "theme.toLight": "Switch to light theme",
  "theme.toDark": "Switch to dark theme",
  "language.label": "Language",
  "language.switchTo": "Switch language to {name}",

  // ─── Settings ───
  "settings.title": "Settings",
  "settings.subtitle": "Data is stored locally in this browser only — no account, no backend.",
  "settings.section.language": "Language",
  "settings.language.title": "Interface language",
  "settings.language.description": "Applies to the whole app. Move notation and algorithm names stay as they are.",
  "settings.section.algProgress": "Algorithm progress",
  "settings.algProgress.title": "Reset all algorithm progress",
  "settings.algProgress.description":
    "Clears learning status and recorded times for every built-in group (OLL, PLL, F2L, Advanced F2L, VLS, ZBLL, CMLL, COLL, …) and reloads its cases from the bundled defaults. Custom groups are left alone.",
  "settings.algProgress.button": "Reset",
  "settings.algProgress.done": "Algorithm progress reset.",
  "settings.section.history": "Solve history",
  "settings.history.title": "Clear all solve history",
  "settings.history.description": "Deletes every recorded solve and session. Algorithm times are not affected.",
  "settings.history.button": "Clear",
  "settings.history.done": "Solve history cleared.",
  "settings.section.backup": "Backup",
  "settings.export.title": "Export data",
  "settings.export.description": "Downloads solve history, sessions, and algorithm progress as a JSON file.",
  "settings.export.button": "Export",
  "settings.import.title": "Import data",
  "settings.import.description": "Restores from a previously exported JSON file. Overwrites existing data with matching keys.",
  "settings.import.button": "Import",
  "settings.import.done": "Data imported — reload the page to see it.",
  "settings.import.failed": "Import failed — file was not valid JSON.",
} as const;

export type MessageKey = keyof typeof en;
