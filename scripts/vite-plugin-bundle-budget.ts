/**
 * vite-plugin-bundle-budget
 * ─────────────────────────────────────────────────────────────────
 * Fails the build when the *initial* JS payload of the public route
 * exceeds a gzip budget. "Initial" = the entry chunk + every chunk
 * that the entry references via static import (i.e. everything
 * Vite emits as `<link rel="modulepreload">` in `index.html`).
 *
 * Why a custom plugin: rollup's `output.manualChunks` controls layout
 * but not size enforcement. We need a hard CI gate so a regression
 * (e.g. someone adds an eager `import * as THREE from 'three'`) fails
 * the pipeline instead of silently inflating LCP on /landing.
 *
 * Algorithm:
 *   1. closeBundle hook: read `dist/index.html`.
 *   2. Extract every `.js` URL referenced via `<script src=>` and
 *      `<link rel="modulepreload" href=>`.
 *   3. gzip each emitted chunk on disk and sum the bytes.
 *   4. If the total exceeds `maxBytes`, throw — Vite fails the build.
 *
 * Usage (vite.config.ts):
 *   import { bundleBudget } from './scripts/vite-plugin-bundle-budget';
 *   plugins: [..., bundleBudget({ maxKBGzip: 180 })]
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

interface Options {
  /** Initial-load gzip budget in kilobytes. Default: 180. */
  maxKBGzip?: number;
  /** Path to the built index.html (relative to outDir). Default: 'index.html'. */
  htmlFile?: string;
  /** Set to false to warn-only (no build failure). Default: true. */
  failOnExceed?: boolean;
}

export function bundleBudget(opts: Options = {}): Plugin {
  const maxKB = opts.maxKBGzip ?? 180;
  const maxBytes = maxKB * 1024;
  const htmlFile = opts.htmlFile ?? 'index.html';
  const fail = opts.failOnExceed !== false;

  let outDir = 'dist';

  return {
    name: 'fxk-bundle-budget',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build?.outDir ?? 'dist';
    },
    closeBundle() {
      const htmlPath = path.resolve(outDir, htmlFile);
      if (!existsSync(htmlPath)) {
        this.warn?.(`[bundle-budget] ${htmlPath} not found — skipping check`);
        return;
      }

      const html = readFileSync(htmlPath, 'utf8');
      const urls = new Set<string>();

      const scriptRe = /<script[^>]+src=["']([^"']+\.js)["']/g;
      const preloadRe = /<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+\.js)["']/g;
      let m: RegExpExecArray | null;
      while ((m = scriptRe.exec(html))) urls.add(m[1]);
      while ((m = preloadRe.exec(html))) urls.add(m[1]);

      const rows: { file: string; gzip: number }[] = [];
      let total = 0;
      for (const url of urls) {
        const rel = url.startsWith('/') ? url.slice(1) : url;
        const filePath = path.resolve(outDir, rel);
        if (!existsSync(filePath)) {
          this.warn?.(`[bundle-budget] referenced chunk missing: ${rel}`);
          continue;
        }
        const buf = readFileSync(filePath);
        const gz = gzipSync(buf).byteLength;
        rows.push({ file: rel, gzip: gz });
        total += gz;
      }

      rows.sort((a, b) => b.gzip - a.gzip);
      const fmt = (n: number) => `${(n / 1024).toFixed(1)} KB`;

      // eslint-disable-next-line no-console
      console.log('\n[bundle-budget] initial public-route payload (gzip):');
      for (const r of rows) {
        // eslint-disable-next-line no-console
        console.log(`  ${fmt(r.gzip).padStart(9)}  ${r.file}`);
      }
      // eslint-disable-next-line no-console
      console.log(`  ─────────────────`);
      // eslint-disable-next-line no-console
      console.log(`  ${fmt(total).padStart(9)}  TOTAL  (budget: ${maxKB} KB)`);

      if (total > maxBytes) {
        const msg =
          `[bundle-budget] Initial JS payload ${fmt(total)} exceeds budget of ${maxKB} KB ` +
          `(over by ${fmt(total - maxBytes)}). Move heavy imports behind React.lazy() or ` +
          `audit eager imports of three / @react-three / postprocessing in the public route.`;
        if (fail) {
          this.error(msg);
        } else {
          this.warn?.(msg);
        }
      } else {
        // eslint-disable-next-line no-console
        console.log(`[bundle-budget] ✓ within budget (${fmt(maxBytes - total)} headroom)\n`);
      }
    },
  };
}
