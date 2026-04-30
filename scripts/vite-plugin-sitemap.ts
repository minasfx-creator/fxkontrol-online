/**
 * vite-plugin-sitemap — generates public/sitemap.xml from a declarative
 * registry (src/seo/publicRoutes.ts) so devs never forget to add a new
 * public route to the sitemap.
 *
 * Behavior:
 *   • buildStart       → writes public/sitemap.xml before assets are emitted
 *                        (so Vite copies the up-to-date file into dist/).
 *   • configureServer  → regenerates on dev server boot AND watches the
 *                        registry source for changes (HMR-friendly DX).
 *   • Idempotent: skips disk write when content is byte-identical to avoid
 *                 spurious file-watcher loops.
 *
 * No external deps. Pure Node fs/path. The registry is loaded fresh from
 * disk on each generation so HMR edits to publicRoutes.ts are reflected
 * without restarting Vite.
 */
import type { Plugin, ViteDevServer } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

interface SitemapPluginOptions {
  /** Absolute path to publicRoutes.ts (default: <root>/src/seo/publicRoutes.ts). */
  registryPath?: string;
  /** Absolute path to the sitemap output (default: <root>/public/sitemap.xml). */
  outputPath?: string;
  /** Project root. Defaults to process.cwd(). */
  root?: string;
}

export function sitemapFromRegistry(options: SitemapPluginOptions = {}): Plugin {
  const root = options.root ?? process.cwd();
  const registryPath = options.registryPath ?? path.join(root, 'src/seo/publicRoutes.ts');
  const outputPath = options.outputPath ?? path.join(root, 'public/sitemap.xml');

  let lastWritten = '';

  // Lightweight TS loader: the registry is intentionally pure (data + string
  // helpers), so we can read the source and evaluate the exported constants
  // by transpiling on the fly via esbuild (already a Vite dep, so no new
  // package). This avoids forcing devs to add a separate ts-node setup.
  async function loadRegistry(): Promise<{
    PUBLIC_ROUTES: Array<{ path: string; changefreq?: string; priority?: number; lastmod?: string }>;
    SITE_ORIGIN: string;
    buildSitemapXml: (
      routes?: unknown[],
      origin?: string,
      today?: string,
    ) => string;
  }> {
    // Use Vite's bundled esbuild to transpile the TS source to a temp file,
    // then dynamic-import it. Cache-bust with mtime so HMR edits are picked
    // up without needing to restart the dev server.
    const { build } = await import('esbuild');
    const stat = await fs.stat(registryPath);
    const tmpDir = path.join(root, 'node_modules', '.cache', 'vite-plugin-sitemap');
    await fs.mkdir(tmpDir, { recursive: true });
    const outFile = path.join(tmpDir, `publicRoutes.${stat.mtimeMs}.mjs`);

    await build({
      entryPoints: [registryPath],
      outfile: outFile,
      bundle: false,
      format: 'esm',
      platform: 'node',
      target: 'node18',
      logLevel: 'silent',
    });

    return await import(pathToFileURL(outFile).href);
  }

  async function generate(server?: ViteDevServer): Promise<void> {
    try {
      const mod = await loadRegistry();
      const xml = mod.buildSitemapXml(mod.PUBLIC_ROUTES, mod.SITE_ORIGIN);

      // Skip write if unchanged — avoids file-watcher feedback loops.
      let prev = '';
      try { prev = await fs.readFile(outputPath, 'utf8'); } catch { /* missing ok */ }
      if (prev === xml && lastWritten === xml) return;

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, xml, 'utf8');
      lastWritten = xml;

      const count = (xml.match(/<url>/g) || []).length;
      const rel = path.relative(root, outputPath) || outputPath;
      // eslint-disable-next-line no-console
      console.log(`[sitemap] wrote ${rel} (${count} URLs from publicRoutes.ts)`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[sitemap] generation failed — keeping previous sitemap.xml:', err);
      // Don't break the build / dev server over a sitemap glitch.
    }
  }

  return {
    name: 'fxk:sitemap-from-registry',

    // Build phase — run BEFORE Vite copies public/ into dist/.
    async buildStart() {
      await generate();
    },

    // Dev phase — generate once on boot and watch the registry source.
    configureServer(server) {
      generate(server);
      server.watcher.add(registryPath);
      server.watcher.on('change', (file) => {
        if (path.resolve(file) === path.resolve(registryPath)) {
          generate(server);
        }
      });
    },
  };
}

export default sitemapFromRegistry;
