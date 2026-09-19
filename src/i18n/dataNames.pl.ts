/**
 * Polish display names for built-in algorithm DATA (case and subgroup names)
 * that are plain descriptions rather than standard cubing terms. Keyed by the
 * exact English name; the stored name never changes (attempts and selections
 * stay keyed by it) — only what's displayed. Names not listed are shown as-is
 * (OLL 28, T perm, Sune…: algorithm names stay English).
 *
 * EO4A (Roux edge orientation): "Top" = górne, "Bot"/"Bottom" = boczne
 * (decided with the maintainer for "2 Top 2 Bot" → "2 górne 2 boczne", applied
 * consistently to the other case names).
 */

export const DATA_NAMES_PL: Record<string, string> = {
  // EO4A cases
  "All 6": "Wszystkie 6",
  "2 Top 2 Bot": "2 górne 2 boczne",
  "Bottom 2": "2 boczne",
  "Top 2 Front 2": "2 górne 2 przednie",
  "4 Top": "4 górne",
  "2 Top Opp": "2 górne przeciwległe",
  "2 Top Adj": "2 górne sąsiednie",
  "1 Top 1 Bot": "1 górna 1 boczna",
  "2 Top Adj 2 Bot": "2 górne sąsiednie 2 boczne",
  // F2L subgroups (slots)
  "Front Right": "Przód prawy",
  "Front Left": "Przód lewy",
  "Back Right": "Tył prawy",
  "Back Left": "Tył lewy",
};
