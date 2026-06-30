import { useEffect, useState, type ReactNode } from "react";
import {
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  resolveTheme,
  ThemeContext,
  THEME_STORAGE_KEY,
  type Theme,
} from "./theme-context";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    resolveTheme(getStoredTheme()),
  );

  useEffect(() => {
    applyTheme(theme);
    setResolvedTheme(resolveTheme(theme));
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyTheme("system");
      setResolvedTheme(getSystemTheme());
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
  };

  const toggleTheme = () => {
    setThemeState((current) => (resolveTheme(current) === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
