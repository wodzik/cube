/**
 * Dark/light theme switch — lives in the app header (global chrome shared by
 * every tab), not on a specific page, since the preference applies app-wide.
 */

import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="shrink-0 p-2 rounded-xl text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors"
    >
      {isDark ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
