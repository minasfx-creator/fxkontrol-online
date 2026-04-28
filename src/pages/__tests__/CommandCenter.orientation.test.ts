/**
 * Guardian — screen.orientation.lock usage in CommandCenter.tsx must remain
 * defensive: optional-chained, catch-silenced, and structurally cast (TS lib.dom
 * does not declare lock/unlock on ScreenOrientation in all versions).
 *
 * Pure structural assertion — does not mount the page (which depends on R3F,
 * stores, and router context).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../../pages/CommandCenter.tsx'),
  'utf8',
);

describe('CommandCenter · screen.orientation guard', () => {
  it('lock() call is optional-chained', () => {
    // Either `orientation?.lock(` (after a structural cast) or
    // `(screen.orientation as any)?.lock?.(` is acceptable.
    expect(SRC).toMatch(/orientation\?\.lock|orientation as any\)\?\.lock\?/);
  });

  it('lock() promise has a .catch handler (never throws unhandled)', () => {
    expect(SRC).toMatch(/lock\([^)]*\)\.catch\(/);
  });

  it('unlock() is also optional-chained on cleanup', () => {
    expect(SRC).toMatch(/orientation\?\.unlock|orientation as any\)\?\.unlock\?/);
  });

  it('does NOT call screen.orientation.lock without a guard (regression sentinel)', () => {
    // Bare `screen.orientation.lock(` (no optional chain, no cast) would crash
    // in browsers without the API and produce TS errors in strict mode.
    expect(SRC).not.toMatch(/[^?.]screen\.orientation\.lock\(/);
  });
});
