/**
 * isEditor semantics
 * ──────────────────
 * MainLayout exposes an `isEditor` flag derived from the URL pathname,
 * which drives the immersive editor chrome (no padding, transitions, HUD).
 *
 * Contract:
 *   isEditor === true  ⇔  pathname === '/skycanvas'
 *   isEditor === false  for /office, /command, /strategy, /field, /, /auth, etc.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

function isEditor(pathname: string): boolean {
  // Mirrors src/layouts/MainLayout.tsx
  return pathname === '/skycanvas';
}

describe('isEditor — immersive editor chrome predicate', () => {
  it('is TRUE only for /skycanvas', () => {
    expect(isEditor('/skycanvas')).toBe(true);
  });

  it.each([
    '/',
    '/auth',
    '/office',
    '/command',
    '/strategy',
    '/field',
    '/pairing',
    '/pairing/usb',
    '/pairing/ble',
    '/skycanvas/extra',
    '/training/center',
    '/dev/skycanvas-lab',
    '/comercial',
    '/landing',
    '/pricing',
  ])('is FALSE for %s', (p) => {
    expect(isEditor(p)).toBe(false);
  });

  it('source of truth in MainLayout matches predicate verbatim', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/layouts/MainLayout.tsx'),
      'utf8',
    );
    expect(src).toMatch(
      /isEditor\s*=\s*location\.pathname\s*===\s*['"]\/skycanvas['"]/,
    );
    expect(src).not.toMatch(/location\.pathname\s*===\s*['"]\/studio['"]/);
    expect(src).not.toMatch(
      /location\.pathname\s*===\s*['"]\/editor['"]/,
    );
  });
});
