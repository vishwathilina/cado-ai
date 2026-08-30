"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { THEME_STORAGE_KEY } from "@/lib/theme-script";
import { applyTheme, runThemeTransition, type ThemeTransitionOrigin } from "@/lib/theme-transition";

type Theme = "light" | "dark" | "system";

type SetThemeOptions = {
  origin?: ThemeTransitionOrigin;
  animate?: boolean;
};

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark" | undefined;
  setTheme: (theme: Theme, options?: SetThemeOptions) => void;
  toggleTheme: (origin?: ThemeTransitionOrigin) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: undefined,
  setTheme: () => {},
  toggleTheme: () => {},
});

function systemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">();

  useEffect(() => {
    const stored = readStoredTheme();
    const resolved = stored === "system" ? systemTheme() : stored;
    setThemeState(stored);
    setResolvedTheme(resolved);
    applyTheme(resolved);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setThemeState((current) => {
        if (current === "system") {
          const next = systemTheme();
          runThemeTransition(
            () => {
              flushSync(() => setResolvedTheme(next));
              applyTheme(next);
            },
            { to: next },
          );
        }
        return current;
      });
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: Theme, options?: SetThemeOptions) => {
    const resolved = next === "system" ? systemTheme() : next;
    const shouldAnimate = options?.animate ?? true;

    const commit = () => {
      flushSync(() => {
        setThemeState(next);
        setResolvedTheme(resolved);
      });
      localStorage.setItem(THEME_STORAGE_KEY, next);
      applyTheme(resolved);
    };

    if (!shouldAnimate) {
      commit();
      return;
    }

    runThemeTransition(commit, { origin: options?.origin, to: resolved });
  }, []);

  const toggleTheme = useCallback(
    (origin?: ThemeTransitionOrigin) => {
      const current = resolvedTheme ?? systemTheme();
      setTheme(current === "dark" ? "light" : "dark", { origin, animate: true });
    },
    [resolvedTheme, setTheme],
  );

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
