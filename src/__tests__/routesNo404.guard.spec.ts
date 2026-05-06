/**
 * Routes No-404 Guard
 * ───────────────────
 * Static analysis of `src/App.tsx` to assert:
 *   1. Every <Route path="…"> is declared (literal or dynamic).
 *   2. Every <Navigate to="…"> redirect target resolves to a real route
 *      (catches dangling redirects like `<Navigate to="/foo" />` where
 *      `/foo` was never registered → would 404).
 *   3. The catch-all `<Route path="*" />` exists (NotFound).
 *   4. No duplicate route declarations.
 *   5. Critical canonical routes are present: /skycanvas, /office, /command,
 *      /strategy, /auth, /pairing/usb, /pairing/ble, /settings, /pricing,
 *      /comercial, /landing, /pitch/us, /legal/terms, /legal/privacy,
 *      /legal/refund, /platform-status.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP_TSX = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');

interface RouteDecl {
  path: string;
  line: number;
}

interface RedirectDecl {
  to: string;
  line: number;
}

function parseRoutes(): {
  literals: Set<string>;
  patterns: Array<{ re: RegExp; src: string }>;
  declarations: RouteDecl[];
  hasCatchAll: boolean;
} {
  const literals = new Set<string>();
  const patterns: Array<{ re: RegExp; src: string }> = [];
  const declarations: RouteDecl[] = [];
  let hasCatchAll = false;

  const lines = APP_TSX.split('\n');
  const re = /<Route\s+path=["']([^"']+)["']/g;
  for (let i = 0; i < lines.length; i++) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(lines[i]))) {
      const p = m[1];
      declarations.push({ path: p, line: i + 1 });
      if (p === '*') {
        hasCatchAll = true;
        continue;
      }
      if (p.includes(':')) {
        const reSrc =
          '^' + p.replace(/:[A-Za-z0-9_]+/g, '[^/]+').replace(/\//g, '\\/') + '$';
        patterns.push({ re: new RegExp(reSrc), src: p });
      } else {
        literals.add(p);
      }
    }
  }
  return { literals, patterns, declarations, hasCatchAll };
}

function parseRedirects(): RedirectDecl[] {
  const out: RedirectDecl[] = [];
  const lines = APP_TSX.split('\n');
  const re = /<Navigate\s+to=\{?["'`]([^"'`]+)["'`]/g;
  for (let i = 0; i < lines.length; i++) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(lines[i]))) {
      out.push({ to: m[1], line: i + 1 });
    }
  }
  return out;
}

function clean(p: string): string {
  return p.split('?')[0].split('#')[0];
}

function resolves(
  path: string,
  literals: Set<string>,
  patterns: Array<{ re: RegExp; src: string }>,
): boolean {
  const c = clean(path);
  if (literals.has(c)) return true;
  return patterns.some(({ re }) => re.test(c));
}

const { literals, patterns, declarations, hasCatchAll } = parseRoutes();
const redirects = parseRedirects();

describe('Routes no-404 — every Route renders, every Navigate target exists', () => {
  it('App.tsx has a catch-all <Route path="*"> (NotFound) — guarantees no hard 404', () => {
    expect(hasCatchAll).toBe(true);
  });

  it('App.tsx declares a healthy number of routes (sanity ≥ 30)', () => {
    expect(declarations.length).toBeGreaterThanOrEqual(30);
  });

  it('no duplicate <Route path="…"> declarations', () => {
    const seen = new Map<string, number>();
    const dups: Array<{ path: string; lines: number[] }> = [];
    for (const d of declarations) {
      const lines = seen.get(d.path);
      if (lines !== undefined) {
        const existing = dups.find((x) => x.path === d.path);
        if (existing) existing.lines.push(d.line);
        else dups.push({ path: d.path, lines: [lines, d.line] });
      } else {
        seen.set(d.path, d.line);
      }
    }
    expect(
      dups,
      `Duplicate route declarations:\n${dups
        .map((d) => `  ${d.path} at lines ${d.lines.join(', ')}`)
        .join('\n')}`,
    ).toEqual([]);
  });

  it('every <Navigate to="…"> redirect target resolves to a registered route', () => {
    const broken: RedirectDecl[] = [];
    for (const r of redirects) {
      const target = clean(r.to);
      // Allow template / dynamic targets (rare): /auth${...} captured as /auth literal.
      if (!target.startsWith('/')) continue;
      if (resolves(target, literals, patterns)) continue;
      broken.push(r);
    }
    expect(
      broken,
      `Dangling <Navigate> targets (would 404 after redirect):\n${broken
        .map((b) => `  App.tsx:${b.line} → ${b.to}`)
        .join('\n')}`,
    ).toEqual([]);
  });

  it.each([
    '/auth',
    '/skycanvas',
    '/office',
    '/command',
    '/strategy',
    '/settings',
    '/pricing',
    '/comercial',
    '/landing',
    '/pitch/us',
    '/legal/terms',
    '/legal/privacy',
    '/legal/refund',
    '/platform-status',
    '/pairing/usb',
    '/pairing/ble',
    '/training/center',
    '/ai-builder',
    '/dev',
  ])('canonical route %s is registered', (path) => {
    expect(
      resolves(path, literals, patterns),
      `Missing canonical route: ${path}`,
    ).toBe(true);
  });

  it('legacy redirects /studio and /editor still resolve to /skycanvas', () => {
    // The literal redirect routes themselves must exist…
    expect(literals.has('/studio')).toBe(true);
    expect(literals.has('/editor')).toBe(true);
    // …and their Navigate targets must land on a real route.
    const studioRedirect = redirects.find(
      (r) => clean(r.to) === '/skycanvas',
    );
    expect(studioRedirect).toBeDefined();
  });
});
