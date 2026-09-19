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

  // ─── Common ───
  "common.close": "Close",
  "common.cancel": "Cancel",
  "common.dismiss": "Dismiss",
  "unit.moves.one": "move",
  "unit.moves.other": "moves",

  // ─── Notices ───
  "update.title": "New version available",
  "update.body": "(ANOTHER) Cube trainer has been updated — reload to get the latest version. Your sessions and solves are stored locally and stay untouched.",
  "update.reload": "Reload now",
  "algUpdate.title": "Default algorithms updated",
  "algUpdate.body": "Some built-in algorithm sets changed in this update. Your learning progress and times are untouched — but if you'd rather start fresh on the new defaults, you can reset built-in groups now.",
  "algUpdate.reset": "Clear built-in progress & reload",
  "algUpdate.keep": "Keep my progress",

  // ─── Timer / inspection ───
  "inspection.label": "Inspection",
  "inspection.inspect": "INSPECT",
  "inspection.plusTwo": "+2 if you start now",
  "inspection.stopOrDnf": "Stop or DNF!",
  "inspection.timesUp": "Time's up!",

  // ─── Case view toggles ───
  "caseView.backStickers": "Back stickers",
  "caseView.backStickers.title": "Show translucent copies of the hidden faces' stickers",
  "caseView.backDistance.title": "How far the back stickers float from the cube",
  "caseView.backDistance.label": "Back sticker distance",
  "caseView.flatView": "Flat view",
  "caseView.flatView.title": "Show a flat unfolded view of the whole cube under the 3D one",

  // ─── Solve summary / lists ───
  "summary.fluency": "{n}% fluency",
  "recentList.showAll": "Show all",

  // ─── Devices ───
  "device.cube": "Cube",
  "device.timer": "Timer",
  "device.connectCube": "Connect Cube",
  "device.connectTimer": "Connect Timer",
  "device.disconnect": "Click to disconnect",

  // ─── Solve controls ───
  "controls.resync": "Re-sync cube visualisation",
  "controls.cancelAttempt": "Cancel attempt",
  "controls.stopSolve": "Stop solve",
  "controls.discard": "Discard solve",
  "controls.saveDnf": "Save as DNF",
  "controls.keepSolving": "Keep solving",

  // ─── Fluency ───
  "fluency.tooltip": "What proportion of your solve you have been turning instead of pausing",

  // ─── Subgroups ───
  "subgroup.settings": "Subgroup settings",
  "subgroup.cases.one": "{n} case",
  "subgroup.cases.other": "{n} cases",
  "subgroup.empty": "No subgroups yet — create one to start organizing this group into folders.",
  "subgroup.new": "New subgroup",

  // ─── Playback / Academy cards ───
  "playback.hint": "Press play or step through the moves with the controls under the cube. Drag the cube to change the view.",
  "academyCard.required": "Required",
  "academyCard.niceToKnow": "Nice to know",
  "academyCard.practiceNamed": "{name} — practice this now",
  "academyCard.show": "Show how to perform this algorithm",
  "academyCard.practice": "Practice this now",

  // ─── Move sequence ───
  "sequence.complete": "Complete!",
  "sequence.undo": "Undo:",
  "sequence.tooManyErrors": "Too many errors!",
  "sequence.reset": "Reset",
  "sequence.showLetters": "Show letters",
  "sequence.hideLetters": "Hide letters (show dots)",
  "sequence.refresh": "Refresh",
  "sequence.errors": "Errors: {n}",

  // ─── Stages ───
  "stage.corners": "Corners",
  "stage.edges": "Edges",
  "stage.orientCorners": "Orient corners",
  "stage.orientEdges": "Orient edges",
  "stage.orientEither": "Orient corners/edges",
  "stage.permuteCorners": "Permute corners",
  "stage.permuteEdges": "Permute edges",

  // ─── Counts ───
  "count.moves.one": "{n} move",
  "count.moves.other": "{n} moves",

  // ─── Stats chart ───
  "stats.mean": "Mean",
  "stats.noData": "No data yet",
  "stats.fullscreen": "Open fullscreen",

  // ─── Timing bar ───
  "timing.totalTime": "Total Time:",
  "timing.recognition": "Recognition:",
  "timing.execution": "Execution:",
  "timing.tps": "TPS:",
  "timing.turns": "Turns:",
  "timing.percentage": "Percentage:",
  "timing.totals": "{label} Totals",
  "timing.totalRecognition": "Total Recognition:",
  "timing.totalTps": "Total TPS:",
  "timing.totalTurns": "Total Turns:",

  // ─── Trainer summary ───
  "trainerSummary.lastAttempt": "Last attempt",
  "trainerSummary.optimalInline": "optimal {n}",
  "trainerSummary.optimal": "Optimal!",
  "trainerSummary.hintUsed": "hint used",
  "trainerSummary.retry": "Retry case",
  "trainerSummary.retry.title": "Practice this exact case again (fresh scramble, same target state)",
  "trainerSummary.yourSolution": "Your solution",
  "trainerSummary.wasted": "Didn't bring the cross closer (distance {from} → {to})",
  "trainerSummary.distance": "Distance {from} → {to}",
  "trainerSummary.closest": "Closest optimal",
  "trainerSummary.solutions": "Optimal solutions ({n})",

  // ─── Trainer summary (plurals) ───
  "trainerSummary.over.one": "+{n} move over optimal",
  "trainerSummary.over.other": "+{n} moves over optimal",

  // ─── Trainer summary (plurals) ───
  "trainerSummary.wastedCount.one": "{n} move didn't reduce the cross distance",
  "trainerSummary.wastedCount.other": "{n} moves didn't reduce the cross distance",

  // ─── Trainer summary (plurals) ───
  "trainerSummary.diverged.one": "Closest optimal — diverged after {n} move",
  "trainerSummary.diverged.other": "Closest optimal — diverged after {n} moves",

  // ─── Solve analysis ───
  "analysis.jump": "Jump the player to this stage",
  "analysis.skip": "Skip",
  "analysis.recog": "recog",
  "analysis.recog.title": "Recognition time",
  "analysis.exec": "exec",
  "analysis.exec.title": "Execution time",
  "analysis.stageTotal": "Total time for this stage",
  "analysis.useScramble": "Use this scramble",
  "analysis.useScramble.title": "Re-scramble to this exact scramble and attempt it again",
  "analysis.steps": "{method} steps",
  "analysis.solveMoves": "Solve moves",
  "analysis.moveToSession": "Move to session…",
  "analysis.newSession": "+ New session…",
  "analysis.confirmDelete": "Click again to delete",
  "analysis.delete": "Delete solve",
} as const;

export type MessageKey = keyof typeof en;
