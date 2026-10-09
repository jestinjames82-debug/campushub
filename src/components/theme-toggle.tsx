"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const themeKey = "campushub-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem(themeKey);
    const next: Theme =
      saved === "dark" || saved === "light"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(next);
    applyTheme(next);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(themeKey, next);
    applyTheme(next);
  }

  const label = theme === "dark" ? "Use light mode" : "Use dark mode";
  return (
    <button
      type="button"
      className={compact ? "icon-button theme-toggle" : "secondary theme-toggle"}
      aria-label={label}
      aria-pressed={theme === "dark"}
      title={label}
      onClick={toggle}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      {!compact && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
      <span className="sr-only">{label}</span>
    </button>
  );
}
