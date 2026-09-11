/**
 * Persisted dark/light theme preference. Default is dark — matches every
 * returning user with nothing stored, and matches the app's un-attributed
 * `:root` CSS values (see style.css's `[data-theme="light"]` override block,
 * the only place the light palette is actually defined). index.html carries
 * a tiny inline script that applies a stored "light" choice before first
 * paint, so this hook's job on mount is just to read the same value back
 * into React state — the DOM attribute is already correct by then.
 */

import { useState } from "react";

const STORAGE_KEY = "nact_theme";

export type Theme = "dark" | "light";

function readStored(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export interface UseThemeReturn {
  theme: Theme;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeReturn {
  const [theme, setTheme] = useState<Theme>(readStored);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage unavailable — preference just won't persist across reloads.
      }
      return next;
    });
  };

  return { theme, toggleTheme };
}
