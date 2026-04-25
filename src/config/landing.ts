/**
 * Landing target configuration.
 *
 * Define para qual plataforma a `/landing` deve ser otimizada:
 *   - "web"    → layout desktop-first; conteúdo escondido em viewports < md (768px)
 *   - "mobile" → layout mobile-first; conteúdo escondido em viewports ≥ md (768px)
 *   - "both"   → layout responsivo padrão (desktop + mobile)
 *
 * Override em runtime via querystring `?target=web|mobile|both` para preview rápido.
 * Use `useLandingTarget()` em componentes para reagir à escolha.
 */

export type LandingTarget = "web" | "mobile" | "both";

/** Default — altere aqui para mudar o alvo padrão da landing. */
export const LANDING_TARGET: LandingTarget = "both";

/** Breakpoint que separa mobile de desktop (Tailwind `md`). */
export const LANDING_MOBILE_BREAKPOINT_PX = 768;

/** Lê o alvo efetivo considerando override via querystring. */
export function resolveLandingTarget(search?: string): LandingTarget {
  if (typeof window === "undefined" && !search) return LANDING_TARGET;
  const qs = search ?? window.location.search;
  const param = new URLSearchParams(qs).get("target");
  if (param === "web" || param === "mobile" || param === "both") return param;
  return LANDING_TARGET;
}

/**
 * Classes Tailwind aplicadas no wrapper raiz da landing para esconder
 * conteúdo no viewport oposto ao alvo escolhido.
 *   - web    → `hidden md:block` (some abaixo de md)
 *   - mobile → `block md:hidden` (some a partir de md)
 *   - both   → sem restrição
 */
export function landingVisibilityClass(target: LandingTarget): string {
  switch (target) {
    case "web":
      return "hidden md:block";
    case "mobile":
      return "block md:hidden";
    case "both":
    default:
      return "";
  }
}
