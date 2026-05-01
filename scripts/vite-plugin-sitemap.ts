/**
 * vite-plugin-sitemap — generates public/sitemap.xml from a declarative
 * registry (src/seo/publicRoutes.mjs) so devs never forget to add a new
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
 * Zero new dependencies — the registry is plain ESM so we can dynamic-import
 * it directly in Node. Cache-busted by mtime so HMR edits are picked up
 * without a server restart.
 */
import type { Plugin, ViteDevServer } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

interface SitemapPluginOptions {
  /** Absolute path to publicRoutes.mjs (default: <root>/src/seo/publicRoutes.mjs). */
  registryPath?: string;
  /** Absolute path to the sitemap output (default: <root>/public/sitemap.xml). */
  outputPath?: string;
  /** Project root. Defaults to process.cwd(). */
  root?: string;
}

interface RegistryModule {
  PUBLIC_ROUTES: Array<{
    path: string;
    changefreq?: string;
    priority?: number;
    lastmod?: string;
  }>;
  SITE_ORIGIN: string;
  buildSitemapXml: (routes?: unknown[], origin?: string, today?: string) => string;
}

export function sitemapFromRegistry(options: SitemapPluginOptions = {}): Plugin {
  const root = options.root ?? process.cwd();
  const registryPath = options.registryPath ?? path.join(root, 'src/seo/publicRoutes.mjs');
  const outputPath = options.outputPath ?? path.join(root, 'public/sitemap.xml');

  let lastWritten = '';

  async function loadRegistry(): Promise<RegistryModule> {
    // Cache-bust by mtime so dev HMR picks up edits without a restart.
    const stat = await fs.stat(registryPath);
    const url = `${pathToFileURL(registryPath).href}?t=${stat.mtimeMs}`;
    return (await import(url)) as RegistryModule;
  }

  async function generate(_server?: ViteDevServer): Promise<void> {
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
      console.log(`[sitemap] wrote ${rel} (${count} URLs from publicRoutes.mjs)`);
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
