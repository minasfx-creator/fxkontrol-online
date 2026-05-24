/**
 * BUG-05 guardian — SkyCanvas opacity gate. Today the gate was set to
 * opacity:1 directly to bypass a Suspense deadlock. This pins the rule:
 * the canvas container must be visible (opacity===1) on first paint and
 * never block on `canvasReady` again.
 *
 * Pure structural assertion — does not mount R3F.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('BUG-05 · SkyCanvas mount gate', () => {
  const src = readFileSync(resolve(__dirname, '../SkyCanvas.tsx'), 'utf8');

  it('container does NOT use a canvasReady-conditional opacity gate', () => {
    // Regression sentinel: this exact pattern caused the black-screen bug.
    expect(src).not.toMatch(/opacity:\s*canvasReady\s*\?\s*1\s*:\s*0(\.\d+)?/);
  });

  it('container has an explicit opacity:1 to guarantee first-paint visibility', () => {
    expect(src).toMatch(/opacity:\s*1/);
  });
});
