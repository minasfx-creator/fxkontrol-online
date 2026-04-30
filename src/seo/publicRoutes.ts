/**
 * SEO public route registry — single source of truth for crawlable URLs.
 *
 * This file is consumed at BUILD TIME by `scripts/vite-plugin-sitemap.ts`
 * to (re)generate `public/sitemap.xml` automatically. Add a new entry here
 * whenever you ship a new public-facing route — never hand-edit sitemap.xml.
 *
 * Pure data + tiny string helpers only. NO React / NO browser APIs so this
 * module can be safely imported by Node during the Vite plugin's
 * `buildStart` and `configureServer` hooks.
 *
 * Conventions:
 *   • path           — origin-relative, must start with "/"
 *   • changefreq     — Sitemap 0.9 vocabulary (always|hourly|daily|weekly|monthly|yearly|never)
 *   • priority       — 0.0..1.0, relative within this site
 *   • lastmod        — optional ISO date (YYYY-MM-DD); falls back to today
 *
 * Routes that should NOT be indexed (auth-gated dashboards, dev sandboxes,
 * internal wizards) MUST be excluded here AND remain Disallow'd in
 * public/robots.txt.
 */

export type ChangeFreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export interface SitemapRoute {
  path: string;
  changefreq?: ChangeFreq;
  priority?: number;
  /** ISO date YYYY-MM-DD. If omitted, build date is used. */
  lastmod?: string;
}

/**
 * Canonical site origin used to build absolute <loc> URLs.
 * Keep in sync with the canonical domain configured in robots.txt
 * and in per-page <link rel="canonical"> tags.
 */
export const SITE_ORIGIN = 'https://fxkontrol.online';

/**
 * Public, crawlable routes only. Order = order of appearance in sitemap.xml.
 *
 * ⛔ Do NOT list: /auth, /editor, /studio, /command*, /field*, /pairing/*,
 *    /dev/*, /settings, /office, /create*, /ai-builder, /fxk16-*,
 *    /real-discovery, or any authenticated/dashboard route. Those must
 *    stay Disallow'd in public/robots.txt as well.
 */
export const PUBLIC_ROUTES: SitemapRoute[] = [
  { path: '/',               changefreq: 'weekly',  priority: 1.0 },
  { path: '/auth',           changefreq: 'monthly', priority: 0.6 },
  { path: '/training',       changefreq: 'monthly', priority: 0.7 },
  { path: '/legal/terms',    changefreq: 'monthly', priority: 0.8 },
  { path: '/legal/refund',   changefreq: 'monthly', priority: 0.8 },
  { path: '/legal/privacy',  changefreq: 'monthly', priority: 0.8 },
  { path: '/editor-ds',      changefreq: 'weekly',  priority: 0.7 },
];

/** Today as YYYY-MM-DD in UTC (stable across machines/timezones). */
export function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Build the full sitemap.xml string from the declarative registry.
 * Pure function — deterministic given (routes, origin, today).
 */
export function buildSitemapXml(
  routes: SitemapRoute[] = PUBLIC_ROUTES,
  origin: string = SITE_ORIGIN,
  today: string = todayIsoDate(),
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const urls = routes
    .map((r) => {
      const loc = `${cleanOrigin}${r.path === '/' ? '/' : r.path}`;
      const lastmod = r.lastmod ?? today;
      const lines = [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
      ];
      if (r.changefreq) lines.push(`    <changefreq>${r.changefreq}</changefreq>`);
      if (r.priority != null) lines.push(`    <priority>${r.priority.toFixed(1)}</priority>`);
      lines.push('  </url>');
      return lines.join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
