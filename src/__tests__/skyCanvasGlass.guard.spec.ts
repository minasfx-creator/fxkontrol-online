/**
 * Guard test — TabbedDockPanel must keep glassmorphism wrapper.
 * Round 16 (skycanvas refine): library/inspector/timeline panels
 * are vidrados via .glass-pane, with cyan-dessat active rim.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const file = readFileSync(
  resolve(__dirname, '..', 'components', 'skycanvas', 'TabbedDockPanel.tsx'),
  'utf8',
);

describe('SkyCanvas glassmorphism guard', () => {
  it('TabbedDockPanel renders inside a glass-pane container', () => {
    expect(file).toMatch(/glass-pane/);
    expect(file).toMatch(/glass-pane-strong/);
  });

  it('active tab uses cyan-dessat rim', () => {
    expect(file).toMatch(/data-\[state=active\]:bg-cyan-500\/15/);
    expect(file).toMatch(/data-\[state=active\]:text-cyan-100/);
  });
});
