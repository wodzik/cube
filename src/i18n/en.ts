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

  // ─── Dates / relative time ───
  "time.justNow": "just now",
  "time.minutesAgo": "{n} min ago",

  // ─── Dates / relative time ───
  "time.hoursAgo.one": "{n} hour ago",
  "time.hoursAgo.other": "{n} hours ago",

  // ─── Dates / relative time ───
  "time.daysAgo.one": "{n} day ago",
  "time.daysAgo.other": "{n} days ago",

  // ─── Solve page ───
  "solve.title": "Speed Solve",
  "solve.hint.scramble": "Perform the scramble shown above",
  "solve.hint.manualSetup": "Set up your cube by hand, then tap Ready",
  "solve.hint.release": "Release to start!",
  "solve.hint.holding": "Keep holding…",
  "solve.hint.makeMove": "make a move",
  "solve.hint.pressSpace": "press space",
  "solve.hint.startTimer": "start the timer",
  "solve.hint.or2": "{a} or {b}",
  "solve.hint.or3": "{list}, or {last}",
  "solve.hint.toBegin": "{text} to begin",
  "solve.movesTps": "{moves} · {tps} TPS",
  "solve.generating": "Generating scramble…",
  "solve.statsLabel": "Session: {name}",
  "solve.nextScramble": "Next scramble",
  "solve.paste.title": "Paste or type a custom scramble",
  "solve.paste.placeholder": "Paste or type a scramble, e.g. R U2 R' F D2…",
  "solve.paste.apply": "Apply",
  "solve.paste.empty": "Enter at least one move.",
  "solve.paste.invalid": "Not valid cube notation: {moves}",
  "solve.reset": "Reset",
  "solve.reset.title": "Restart this scramble from the beginning",
  "solve.ready": "Ready",
  "solve.readyScratch": "Scrambled by hand — ready",
  "solve.ready.titleScratch": "Skip matching the shown scramble exactly — use whatever's been scrambled by hand so far",
  "solve.ready.title": "Lock in the position you've just set up by hand as the start of this attempt",
  "solve.recent": "Recent solves",
  "solve.mv": "{n} mv",
  "solve.perPage": "Per page",
  "solve.all": "All",
  "solve.clickToSort": "Click a column to sort",
  "solve.col.time": "Time",
  "solve.col.moves": "Moves",
  "solve.col.fluency": "Fluency",
  "solve.col.method": "Method",
  "solve.col.date": "Date",
  "solve.col.ended": "Ended",
  "solve.moveToOther": "Move to another session",
  "solve.moveToSession": "Move to session",
  "solve.newSession": "New session…",
  "solve.confirmDelete": "Click again to delete",
  "solve.delete": "Delete solve",
  "solve.prevPage": "Previous page",
  "solve.nextPage": "Next page",
  "solve.page": "Page {n} / {total}",

  // ─── Sessions ───
  "session.stage.scratch": "Scratch",
  "session.stage.cross": "Cross → end",
  "session.stage.f2l": "F2L → end",
  "session.stage.oll": "OLL → end",
  "session.stage.pll": "Last layer",
  "session.switch": "Switch or manage sessions",
  "session.settings": "Session settings",
  "session.edit": "Edit session",
  "session.confirmDelete": "Click again to delete",
  "session.delete": "Delete session",
  "session.new": "New session",
  "session.field.name": "Name",
  "session.field.namePlaceholder": "Session name",
  "session.field.input": "Start/stop input",
  "session.input.cube": "Cube",
  "session.input.cube.desc": "Starts on your first move, stops automatically once the cube is solved.",
  "session.input.spacebar": "Spacebar",
  "session.input.spacebar.desc": "Hold space to arm, release to start; press space again to stop.",
  "session.input.timer": "BT Timer",
  "session.input.timer.desc": "Start and stop with a connected GAN Smart Timer.",
  "session.field.start": "Starting point",
  "session.start.scratch": "Scratch",
  "session.start.scratch.desc": "Full random scramble, solve start to finish.",
  "session.start.cross": "Cross done",
  "session.start.cross.desc": "Hand-set a solved cross, then time F2L → OLL → PLL.",
  "session.start.f2l": "F2L done",
  "session.start.f2l.desc": "Hand-set a solved F2L, then time OLL → PLL.",
  "session.start.oll": "OLL done",
  "session.start.oll.desc": "Hand-set solved F2L + OLL, then time PLL.",
  "session.start.pll": "Last layer done",
  "session.start.pll.desc": "Hand-set everything except the final AUF.",
  "session.field.method": "Solving method",
  "session.method.hint": "Which stages the live progress bar tracks — auto-detection isn't available yet, so pick the method you're actually using.",
  "session.method.cfop.desc": "Cross, F2L pairs (any order), OLL, PLL.",
  "session.method.lbl": "Layer-By-Layer",
  "session.method.lbl.desc": "Cross, first layer corners, second-layer edges, OLL, PLL.",
  "session.method.roux.desc": "First block, second block, CMLL, last six edges.",
  "session.field.inspection": "Inspection",
  "session.inspection.wca": "15s WCA",
  "session.inspection.custom": "Custom",
  "session.inspection.none": "None",
  "session.inspection.seconds": "seconds (1–120)",
  "session.inspection.invalid": "Enter 1–120",
  "session.field.display": "Display",
  "session.display.time": "Time",
  "session.display.moves": "Move count only",
  "session.display.hint": "Hide solve times everywhere in this session — the timer, last-solve result, and history show move count instead. Times are still recorded, just not shown.",
  "common.save": "Save",
} as const;

export type MessageKey = keyof typeof en;
