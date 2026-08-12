"use client";

import { usePathname } from "next/navigation";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const pathname = usePathname();

  // The admin shell already provides a theme control in its top bar.
  if (pathname.startsWith("/admin")) return null;

  function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem("avkarsh-theme", next);
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle light and dark mode"
      title="Toggle light and dark mode"
    >
      <span className="theme-light-copy" aria-hidden="true">☾ Dark</span>
      <span className="theme-dark-copy" aria-hidden="true">☀ Light</span>
    </button>
  );
}
