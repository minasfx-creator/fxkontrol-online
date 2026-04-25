/**
 * Landing configuration — provedor, URLs canônicas e SEO.
 *
 * **Edite apenas as constantes em LANDING_SITE** para apontar a landing
 * para outro provedor/domínio. Todas as tags meta/OG/Twitter/canonical
 * em `src/pages/Landing.tsx` são derivadas daqui via `buildLandingSeo()`.
 *
 * Targets:
 *   - "web"    → desktop-first; conteúdo escondido em viewports < md (768px)
 *   - "mobile" → mobile-first; conteúdo escondido em viewports ≥ md (768px)
 *   - "both"   → responsivo (default)
 *
 * Override em runtime via querystring `?target=web|mobile|both`.
 */

export type LandingTarget = "web" | "mobile" | "both";

/** Default — altere aqui para mudar o alvo padrão da landing. */
export const LANDING_TARGET: LandingTarget = "both";

/** Breakpoint que separa mobile de desktop (Tailwind `md`). */
export const LANDING_MOBILE_BREAKPOINT_PX = 768;

// ─────────────────────────────────────────────────────────────────────
// Provedor & URLs alvo da landing
// ─────────────────────────────────────────────────────────────────────

/**
 * Provedor onde a landing está hospedada — usado para meta tags
 * `generator`/`og:site_name` e para gerar telemetria.
 */
export type LandingProvider =
  | "lovable"
  | "vercel"
  | "netlify"
  | "cloudflare"
  | "self-hosted";

export interface LandingSiteConfig {
  /** Identificador do provedor de hospedagem. */
  provider: LandingProvider;
  /** Origem absoluta canônica (sem barra final). Ex.: `https://fxkontrol.online` */
  origin: string;
  /** Caminho da landing dentro da origem. Ex.: `/landing` */
  path: string;
  /** Nome do site / brand para `og:site_name` e JSON-LD. */
  siteName: string;
  /** Organização publisher (JSON-LD). */
  publisher: string;
  /** Locale BCP-47 + Open Graph. */
  locale: { html: string; og: string };
  /** Handle Twitter sem `@` para `twitter:site`. */
  twitterHandle: string;
  /** SEO textual. */
  title: string;
  description: string;
  keywords: string[];
  /** Imagem social (1200x630 recomendada). */
  ogImage: { url: string; alt: string };
  /**
   * Hosts considerados "alias" do canônico (sem protocolo). Acessos por esses
   * hosts disparam redirect 301-equivalente (location.replace) para a origem
   * canônica. Hosts de preview/dev devem ficar em `previewHosts` (não redireciona).
   * Ex.: `["www.fxkontrol.online", "fxkontrol-online.lovable.app"]`
   */
  aliasHosts?: string[];
  /**
   * Hosts onde a landing roda mas NÃO deve redirecionar (preview, dev,
   * editor Lovable). Match parcial (`includes`).
   */
  previewHosts?: string[];
  /**
   * Querystrings preservadas no redirect. Tudo fora dessa lista é descartado
   * para evitar duplicidade indexável (ex.: utm_*, fbclid). Default: ["target"].
   */
  preservedQueryParams?: string[];
}

/**
 * ⚠️ ÚNICA FONTE DE VERDADE para URL/SEO da landing.
 * Edite este objeto para apontar para outro provedor/domínio.
 */
export const LANDING_SITE: LandingSiteConfig = {
  provider: "lovable",
  origin: "https://fxkontrol.online",
  path: "/landing",
  siteName: "FX KONTROL",
  publisher: "Minas FX",
  locale: { html: "pt-BR", og: "pt_BR" },
  twitterHandle: "MinasFX",
  title: "FX KONTROL — Software de shows pirotécnicos, SFX, DMX e ArtNet",
  description:
    "Plataforma moderna para design, simulação e controle de shows pirotécnicos, SFX, drones, DMX e ArtNet. Migre do Finale 3D com menos custo e mais automação.",
  keywords: [
    "shows pirotécnicos",
    "drone show",
    "DMX",
    "ArtNet",
    "sACN",
    "Finale 3D",
    "SFX",
    "FX KONTROL",
    "Minas FX",
    "pirotecnia profissional",
  ],
  ogImage: {
    url: "https://storage.googleapis.com/gpt-engineer-file-uploads/HNWwID77XlhLhwds00GYkOiIPMm2/social-images/social-1777070046139-ChatGPT_Image_23_de_abr._de_2026,_21_34_00.webp",
    alt: "FX KONTROL — editor 3D de shows pirotécnicos e drones",
  },
};

/** URL canônica absoluta — derivada de `origin + path`. */
export function landingCanonical(cfg: LandingSiteConfig = LANDING_SITE): string {
  const origin = cfg.origin.replace(/\/+$/, "");
  const path = cfg.path.startsWith("/") ? cfg.path : `/${cfg.path}`;
  return `${origin}${path}`;
}

// ─────────────────────────────────────────────────────────────────────
// Geradores de meta tags (consumidos por src/pages/Landing.tsx)
// ─────────────────────────────────────────────────────────────────────

export interface MetaTag {
  attr: "name" | "property";
  key: string;
  content: string;
}

export interface LinkTag {
  rel: string;
  href: string;
  extra?: Record<string, string>;
}

export interface LandingSeoBundle {
  title: string;
  htmlLang: string;
  metas: MetaTag[];
  links: LinkTag[];
  jsonLd: Record<string, unknown>;
}

/**
 * Gera o pacote completo de tags SEO (meta + link + JSON-LD)
 * a partir da config. Use em `useEffect` para injetar no <head>.
 */
export function buildLandingSeo(cfg: LandingSiteConfig = LANDING_SITE): LandingSeoBundle {
  const canonical = landingCanonical(cfg);
  const keywords = cfg.keywords.join(", ");

  const metas: MetaTag[] = [
    { attr: "name", key: "description", content: cfg.description },
    { attr: "name", key: "robots", content: "index,follow" },
    { attr: "name", key: "author", content: cfg.publisher },
    { attr: "name", key: "keywords", content: keywords },
    { attr: "name", key: "generator", content: `Lovable (provider=${cfg.provider})` },
    // Open Graph
    { attr: "property", key: "og:type", content: "website" },
    { attr: "property", key: "og:site_name", content: cfg.siteName },
    { attr: "property", key: "og:locale", content: cfg.locale.og },
    { attr: "property", key: "og:url", content: canonical },
    { attr: "property", key: "og:title", content: cfg.title },
    { attr: "property", key: "og:description", content: cfg.description },
    { attr: "property", key: "og:image", content: cfg.ogImage.url },
    { attr: "property", key: "og:image:alt", content: cfg.ogImage.alt },
    // Twitter
    { attr: "name", key: "twitter:card", content: "summary_large_image" },
    { attr: "name", key: "twitter:site", content: `@${cfg.twitterHandle}` },
    { attr: "name", key: "twitter:title", content: cfg.title },
    { attr: "name", key: "twitter:description", content: cfg.description },
    { attr: "name", key: "twitter:image", content: cfg.ogImage.url },
    { attr: "name", key: "twitter:image:alt", content: cfg.ogImage.alt },
  ];

  const ogOrigin = (() => {
    try {
      return new URL(cfg.ogImage.url).origin;
    } catch {
      return null;
    }
  })();

  const links: LinkTag[] = [
    { rel: "canonical", href: canonical },
    ...(ogOrigin
      ? [
          { rel: "preconnect", href: ogOrigin, extra: { crossorigin: "" } } as LinkTag,
          { rel: "dns-prefetch", href: ogOrigin } as LinkTag,
          {
            rel: "preload",
            href: cfg.ogImage.url,
            extra: { as: "image", fetchpriority: "high" },
          } as LinkTag,
        ]
      : []),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: cfg.title,
    description: cfg.description,
    url: canonical,
    inLanguage: cfg.locale.html,
    primaryImageOfPage: cfg.ogImage.url,
    isPartOf: {
      "@type": "WebSite",
      name: cfg.siteName,
      url: cfg.origin.replace(/\/+$/, "") + "/",
    },
    publisher: { "@type": "Organization", name: cfg.publisher },
  };

  return { title: cfg.title, htmlLang: cfg.locale.html, metas, links, jsonLd };
}

// ─────────────────────────────────────────────────────────────────────
// Targets (web | mobile | both) — preservado da config anterior
// ─────────────────────────────────────────────────────────────────────

/** Lê o alvo efetivo considerando override via querystring. */
export function resolveLandingTarget(search?: string): LandingTarget {
  if (typeof window === "undefined" && !search) return LANDING_TARGET;
  const qs = search ?? window.location.search;
  const param = new URLSearchParams(qs).get("target");
  if (param === "web" || param === "mobile" || param === "both") return param;
  return LANDING_TARGET;
}

/**
 * Classes Tailwind aplicadas no wrapper raiz da landing.
 *   - web    → `hidden md:block`
 *   - mobile → `block md:hidden`
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
