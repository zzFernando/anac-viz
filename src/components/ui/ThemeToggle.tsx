"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/themeContext";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      title={isDark ? "Modo claro" : "Modo escuro"}
      aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
      className="grid h-7 w-7 place-items-center rounded-full text-white/70
                 hover:bg-white/15 hover:text-white transition-colors"
    >
      {isDark ? (
        <Sun size={16} strokeWidth={2.2} aria-hidden="true" />
      ) : (
        <Moon size={16} strokeWidth={2.2} aria-hidden="true" />
      )}
    </button>
  );
}
