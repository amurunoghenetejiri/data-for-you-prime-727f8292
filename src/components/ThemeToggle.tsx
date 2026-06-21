import { Moon, Sun } from "lucide-react";
import { useApp } from "@/context/AppContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useApp();
  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="relative h-10 w-10 grid place-items-center rounded-full hover:bg-muted transition-colors"
    >
      <Sun className={`h-5 w-5 absolute transition-all ${theme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
      <Moon className={`h-5 w-5 absolute transition-all ${theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
    </button>
  );
}