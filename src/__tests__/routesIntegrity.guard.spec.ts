/**
 * Routes Integrity Guard
 * ──────────────────────
 * Statically scans the source tree for internal navigation references
 *   (`to="/x"`, `navigate('/x')`, `path: '/x'`, `<Navigate to="/x"`)
 * and asserts every path resolves to either:
 *   1. A literal `<Route path="/x">` registered in `src/App.tsx`, OR
 *   2. A dynamic route whose pattern matches (e.g. `/pairing/usb` ↔ `/pairing/:transport`).
 *
 * Goal: prevent dangling internal links that would 404 in production.
 * External URLs, anchors, mailto, asset paths and dev-only test fixtures
 * are excluded.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = join(process.cwd(), 'src');

const SKIP_DIRS = new Set([
  '__tests__',
  '_quarantine',
  'test',
  'node_modules',
]);
const SKIP_FILE_RE = /\.(test|spec)\.[tj]sx?$/;

// Files that are *allowed* to mention legacy paths (App.tsx redirects).
const LEGACY_ALLOWED = new Set([join(ROOT, 'App.tsx')]);

// Paths legitimately external/router-handled but never registered as routes.
const NEVER_ROUTES_RE =
  /^(https?:|mailto:|tel:|#|\/api\/|\/wasm\/|\/assets\/|\/static\/|\/auth\?|\/auth#|\/$)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      walk(full, out);
    } else if (st.isFile()) {
      const ext = extname(entry);
      if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) continue;
      if (SKIP_FILE_RE.test(entry)) continue;
      out.push(full);
    }
  }
  return out;
}

/** Extract all literal `Route path="…"` declarations from App.tsx */
function loadRegisteredRoutes(): { literal: Set<string>; patterns: RegExp[] } {
  const src = readFileSync(join(ROOT, 'App.tsx'), 'utf8');
  const literal = new Set<string>();
  const patterns: RegExp[] = [];
  const re = /<Route\s+path=["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const p = m[1];
    if (p === '*') continue;
    if (p === '/') {
      literal.add('/');
      continue;
    }
    if (p.includes(':')) {
      const reSrc =
        '^' + p.replace(/:[A-Za-z0-9_]+/g, '[^/]+').replace(/\//g, '\\/') + '$';
      patterns.push(new RegExp(reSrc));
    } else {
      literal.add(p);
    }
  }
  return { literal, patterns };
}

function clean(p: string): string {
  return p.split('?')[0].split('#')[0];
}

function isRegistered(
  path: string,
  literal: Set<string>,
  patterns: RegExp[],
): boolean {
  const c = clean(path);
  if (literal.has(c)) return true;
  return patterns.some((re) => re.test(c));
}

interface LinkRef {
  file: string;
  line: number;
  path: string;
  ctx: string;
}

function extractLinks(file: string): LinkRef[] {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const refs: LinkRef[] = [];
  const patterns: RegExp[] = [
    /\bto=["'`](\/[A-Za-z0-9_\-\/?#=&:.]*)["'`]/g,
    /\bnavigate\(\s*["'`](\/[A-Za-z0-9_\-\/?#=&:.]*)["'`]/g,
    /\bhref=["'`](\/[A-Za-z0-9_\-\/?#=&:.]*)["'`]/g,
    /\bpath:\s*["'`](\/[A-Za-z0-9_\-\/?#=&:.]*)["'`]/g,
  ];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const trimmed = ln.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    for (const re of patterns) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(ln))) {
        refs.push({
          file,
          line: i + 1,
          path: m[1],
          ctx: ln.trim().slice(0, 120),
        });
      }
    }
  }
  return refs;
}

describe('Routes integrity — every internal link resolves to a registered route', () => {
  const { literal, patterns } = loadRegisteredRoutes();
  const files = walk(ROOT);
  const allRefs = files.flatMap(extractLinks);

  it('App.tsx has at least one route registered (sanity)', () => {
    expect(literal.size + patterns.length).toBeGreaterThan(20);
  });

  it('no internal navigation references the legacy /studio path (outside App.tsx redirect)', () => {
    const violations = allRefs.filter(
      (r) => clean(r.path) === '/studio' && !LEGACY_ALLOWED.has(r.file),
    );
    expect(
      violations,
      `Legacy /studio links found:\n${violations
        .map((v) => `  ${v.file}:${v.line} → ${v.path}`)
        .join('\n')}`,
    ).toEqual([]);
  });

  it('no internal navigation references the legacy bare /editor path (outside App.tsx redirect)', () => {
    const violations = allRefs.filter(
      (r) => clean(r.path) === '/editor' && !LEGACY_ALLOWED.has(r.file),
    );
    expect(
      violations,
      `Legacy /editor links found:\n${violations
        .map((v) => `  ${v.file}:${v.line} → ${v.path}`)
        .join('\n')}`,
    ).toEqual([]);
  });

  it('every internal link resolves to a registered route or pattern', () => {
    const unresolved: LinkRef[] = [];
    for (const r of allRefs) {
      const p = r.path;
      if (NEVER_ROUTES_RE.test(p)) continue;
      if (!p.startsWith('/')) continue;
      if (LEGACY_ALLOWED.has(r.file)) continue;
      if (isRegistered(p, literal, patterns)) continue;
      unresolved.push(r);
    }
    expect(
      unresolved,
      `Unresolved internal routes (would 404):\n${unresolved
        .map((v) => `  ${v.file}:${v.line} → ${v.path}\n    ${v.ctx}`)
        .join('\n')}`,
    ).toEqual([]);
  });
});
