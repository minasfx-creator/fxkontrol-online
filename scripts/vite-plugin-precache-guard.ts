/**
 * vite-plugin-precache-guard
 * ──────────────────────────────────────────────────────────────────────
 * Build-time guard contra arquivos pesados em `public/` entrarem no
 * precache do Service Worker (vite-plugin-pwa / Workbox).
 *
 * Comportamento:
 *  1. Varre `public/` recursivamente em `buildStart`.
 *  2. Para cada arquivo > `maxBytes`:
 *       - loga um WARN claro no console do build.
 *       - emite o caminho relativo (com glob) para que o caller injete
 *         em `workbox.globIgnores` antes de passar para o VitePWA.
 *  3. Aborta o build (opcional) se `failOnExceed` = true.
 *
 * Uso em vite.config.ts:
 *   const guard = precacheGuard({ maxBytes: 2 * 1024 * 1024 });
 *   ...
 *   VitePWA({
 *     workbox: {
 *       globIgnores: [...existentes, ...guard.globIgnores],
 *       ...
 *     }
 *   }),
 *   guard.plugin,
 */
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

export interface PrecacheGuardOptions {
  /** Diretório raiz a varrer. Default: `public`. */
  publicDir?: string;
  /** Tamanho máximo (bytes) permitido no precache. Default: 2 MiB. */
  maxBytes?: number;
  /** Aborta o build se algum arquivo exceder. Default: false (apenas warn). */
  failOnExceed?: boolean;
}

export interface PrecacheGuardResult {
  plugin: Plugin;
  /** Globs (relativos a `public/`) a injetar em `workbox.globIgnores`. */
  globIgnores: string[];
  /** Arquivos detectados acima do limite. Populado em buildStart. */
  oversized: Array<{ path: string; bytes: number }>;
}

function walk(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full));
  }
  return out;
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KiB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MiB`;
}

export function precacheGuard(opts: PrecacheGuardOptions = {}): PrecacheGuardResult {
  const publicDir = opts.publicDir ?? "public";
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const failOnExceed = opts.failOnExceed ?? false;

  const oversized: Array<{ path: string; bytes: number }> = [];
  const globIgnores: string[] = [];

  // Scan synchronously at module load so globIgnores already populates
  // the workbox config evaluated in vite.config.ts.
  const root = path.resolve(process.cwd(), publicDir);
  const files = walk(root);
  for (const rel of files) {
    const abs = path.join(root, rel);
    const { size } = fs.statSync(abs);
    if (size > maxBytes) {
      oversized.push({ path: rel, bytes: size });
      // Workbox glob is rooted at the build output (which mirrors public/).
      globIgnores.push(`**/${rel.replace(/\\/g, "/")}`);
    }
  }

  const plugin: Plugin = {
    name: "precache-guard",
    apply: "build",
    buildStart() {
      if (oversized.length === 0) {
        // eslint-disable-next-line no-console
        console.log(
          `\n[precache-guard] OK — nenhum arquivo em ${publicDir}/ excede ${fmtBytes(maxBytes)}.\n`,
        );
        return;
      }
      const lines = oversized
        .sort((a, b) => b.bytes - a.bytes)
        .map((f) => `   • ${f.path.padEnd(60)} ${fmtBytes(f.bytes)}`)
        .join("\n");
      const banner =
        `\n[precache-guard] ⚠  ${oversized.length} arquivo(s) em ${publicDir}/ excedem ${fmtBytes(maxBytes)} ` +
        `e foram excluídos do precache do Service Worker:\n${lines}\n` +
        `   (servidos via runtime — não inflam o cache inicial do PWA)\n`;
      if (failOnExceed) {
        this.error(banner);
      } else {
        // eslint-disable-next-line no-console
        console.warn(banner);
      }
    },
  };

  return { plugin, globIgnores, oversized };
}
