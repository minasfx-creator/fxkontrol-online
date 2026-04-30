/**
 * SEO public route registry — TypeScript surface.
 *
 * The actual data + sitemap builder live in `publicRoutes.mjs` (plain ESM)
 * so the build-time Vite plugin can import them in Node without a TS
 * transpile step. This file just re-exports them with proper types for app
 * code that wants to consume the registry (e.g. for a future "site index"
 * page or for tests).
 */

// `.mjs` extension is required so Vite/Node ESM can resolve it directly.
// tsconfig has `allowJs` / `moduleResolution: bundler` so this works.
export {
  SITE_ORIGIN,
  PUBLIC_ROUTES,
  buildSitemapXml,
  todayIsoDate,
} from './publicRoutes.mjs';

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
