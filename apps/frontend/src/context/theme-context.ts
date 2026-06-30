import { createContext } from "react";

export type Theme = "light" | "dark" | "system";

export type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export const THEME_STORAGE_KEY = "examflow-theme";

export function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");
}

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}
