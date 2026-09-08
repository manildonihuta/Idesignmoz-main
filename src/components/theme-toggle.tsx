"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "idesign-theme";

type Theme = "dark" | "light";

const listeners = new Set<() => void>();

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", () => listeners.forEach((l) => l()));
}

function getSnapshot(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function getServerSnapshot(): Theme {
  return "dark";
}

function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute("data-theme", theme);
  listeners.forEach((l) => l());
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === "dark";
  const label = isDark ? "Mudar para tema claro" : "Mudar para tema escuro";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="theme-toggle"
      aria-label={label}
      title={label}
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}