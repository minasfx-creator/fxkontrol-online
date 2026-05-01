/**
 * SEO public route registry — single source of truth for crawlable URLs.
 *
 * ⚠ This file is plain ESM JavaScript (NOT TypeScript) on purpose: it is
 * imported at BUILD TIME by `scripts/vite-plugin-sitemap.ts` (running in
 * Node) AND at runtime by the React app via `src/seo/publicRoutes.ts`.
 * Keeping it as `.mjs` avoids a TS transpile step in the Vite plugin and
 * keeps the plugin zero-dep.
 *
 * Add a new entry here whenever you ship a new public-facing route — never
 * hand-edit `public/sitemap.xml`. The Vite plugin will rewrite it on the
 * next dev-server boot or production build.
 *
 * Excluded by design (must stay Disallow'd in robots.txt too):
 *   /studio, /command*, /editor, /field*, /pairing/*, /dev/*, /settings,
 *   /office, /create*, /ai-builder, /fxk16-*, /real-discovery, etc.
 */

/**
 * Canonical site origin used to build absolute <loc> URLs.
 * Keep in sync with public/robots.txt and per-page <link rel="canonical">.
 */
export const SITE_ORIGIN = 'https://fxkontrol.online';

/**
 * Public, crawlable routes. Order = order of appearance in sitemap.xml.
 *
 * Each entry: { path, changefreq?, priority?, lastmod? }
 *   • path        — origin-relative, must start with "/"
 *   • changefreq  — Sitemap 0.9: always|hourly|daily|weekly|monthly|yearly|never
 *   • priority    — 0.0..1.0, relative within this site
 *   • lastmod     — optional ISO YYYY-MM-DD; falls back to today
 */
export const PUBLIC_ROUTES = [
  { path: '/',              changefreq: 'weekly',  priority: 1.0 },
  { path: '/auth',          changefreq: 'monthly', priority: 0.6 },
  { path: '/training',      changefreq: 'monthly', priority: 0.7 },
  { path: '/legal/terms',   changefreq: 'monthly', priority: 0.8 },
  { path: '/legal/refund',  changefreq: 'monthly', priority: 0.8 },
  { path: '/legal/privacy', changefreq: 'monthly', priority: 0.8 },
  { path: '/editor-ds',     changefreq: 'weekly',  priority: 0.7 },
  { path: '/pitch/us',      changefreq: 'weekly',  priority: 0.9 },
];

/** Today as YYYY-MM-DD in UTC (stable across machines/timezones). */
export function todayIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * Build the full sitemap.xml string from the declarative registry.
 * Pure function — deterministic given (routes, origin, today).
 */
export function buildSitemapXml(
  routes = PUBLIC_ROUTES,
  origin = SITE_ORIGIN,
  today = todayIsoDate(),
) {
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

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
