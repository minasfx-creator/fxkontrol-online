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

  // Lightweight TS loader: the registry is intentionally a *pure* module
  // (data + string helpers, no external imports beyond `type` ones). We
  // strip TS-only syntax with a small regex pass and dynamic-import the
  // result as ESM. This keeps the plugin zero-dep — no esbuild/ts-node.
  async function loadRegistry(): Promise<{
    PUBLIC_ROUTES: Array<{ path: string; changefreq?: string; priority?: number; lastmod?: string }>;
    SITE_ORIGIN: string;
    buildSitemapXml: (
      routes?: unknown[],
      origin?: string,
      today?: string,
    ) => string;
  }> {
    const src = await fs.readFile(registryPath, 'utf8');
    const stripped = stripTypeScript(src);

    const stat = await fs.stat(registryPath);
    const tmpDir = path.join(root, 'node_modules', '.cache', 'vite-plugin-sitemap');
    await fs.mkdir(tmpDir, { recursive: true });
    const outFile = path.join(tmpDir, `publicRoutes.${stat.mtimeMs}.mjs`);
    await fs.writeFile(outFile, stripped, 'utf8');

    return await import(pathToFileURL(outFile).href);
  }

  /**
   * Minimal TS → JS pass for the registry module:
   *   • drop `import type ... from '...';` lines
   *   • drop standalone `export type ...` and `export interface ...` blocks
   *   • drop `: TypeAnnotation` on top-level const declarations (e.g.
   *     `export const FOO: SitemapRoute[] = [...]` → `export const FOO = [...]`)
   *   • drop function param/return type annotations
   *
   * The registry MUST stay simple enough for these heuristics to suffice
   * (no decorators, no enums, no namespaces). If you need richer TS, switch
   * to esbuild — but then add @types/node and esbuild as devDeps.
   */
  function stripTypeScript(src: string): string {
    let out = src;
    // 1. Remove `import type ... ;`
    out = out.replace(/^\s*import\s+type\s+[^;]+;\s*$/gm, '');
    // 2. Remove `export type Foo = ...;` (single line or until matching ;)
    out = out.replace(/^\s*export\s+type\s+\w[\s\S]*?;\s*$/gm, '');
    // 3. Remove `export interface Foo { ... }` blocks (balanced braces, depth-1).
    out = out.replace(/^\s*export\s+interface\s+\w+[^{]*\{[\s\S]*?^\}\s*$/gm, '');
    // 4. Remove `interface Foo { ... }` (non-exported).
    out = out.replace(/^\s*interface\s+\w+[^{]*\{[\s\S]*?^\}\s*$/gm, '');
    // 5. Strip type annotations on simple `const NAME: Type = ` / `let` / `var`.
    //    Conservative: only when the annotation has no nested braces/parens.
    out = out.replace(/(\b(?:const|let|var)\s+\w+)\s*:\s*[^=;]+?(\s*=)/g, '$1$2');
    // 6. Strip return type annotations on functions: `): Type {` → `) {`.
    //    Conservative: bail if the annotation contains a `{` (object types).
    out = out.replace(/\)\s*:\s*[^{=;]+?(\s*\{)/g, ')$1');
    // 7. Strip param annotations: `(name: Type, other: Type = default)`.
    //    Walk parameter lists conservatively.
    out = out.replace(/\(([^()]*)\)/g, (_m, inner: string) => {
      if (!inner.includes(':')) return `(${inner})`;
      const parts = inner.split(',').map((p) => {
        const eq = p.indexOf('=');
        const name = eq === -1 ? p : p.slice(0, eq);
        const def = eq === -1 ? '' : p.slice(eq);
        const colon = name.indexOf(':');
        const cleanName = colon === -1 ? name : name.slice(0, colon);
        return cleanName + def;
      });
      return `(${parts.join(',')})`;
    });
    return out;
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
