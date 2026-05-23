import { useEffect, useState, useCallback } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * Toggle de tema (claro/escuro) exclusivo da /landing.
 *
 * - Persiste preferência em `localStorage` sob a chave `fxk-landing-theme`
 *   (`"light"` | `"dark"`). Sem entrada, segue o default do app (escuro).
 * - Aplica a classe `landing-light` no `<html>` enquanto a landing está
 *   montada. Restaura ao desmontar para não vazar tema para o resto do app.
 * - Respeita `prefers-color-scheme` apenas se o usuário **nunca** escolheu
 *   manualmente (sem chave em localStorage).
 */

const STORAGE_KEY = "fxk-landing-theme";
type Theme = "light" | "dark";

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : null;
}

function resolveInitialTheme(): Theme {
  const stored = readStoredTheme();
  if (stored) return stored;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("landing-light", theme === "light");
}

export function LandingThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());

  // Aplica + cleanup ao desmontar (evita vazar para outras rotas).
  useEffect(() => {
    applyTheme(theme);
    return () => {
      document.documentElement.classList.remove("landing-light");
    };
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage indisponível (modo privado / quota) — segue só em memória */
      }
      return next;
    });
  }, []);

  const isLight = theme === "light";
  const label = isLight ? "Ativar modo escuro" : "Ativar modo claro";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isLight}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/40 text-muted-foreground backdrop-blur transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {isLight ? <Moon aria-hidden="true" className="h-4 w-4" /> : <Sun aria-hidden="true" className="h-4 w-4" />}
    </button>
  );
}

export default LandingThemeToggle;
