/**
 * Visual regression smoke tests for the main editor layout (dark mode).
 *
 * jsdom can't pixel-diff, so we use serialized DOM snapshots as a structural
 * "visual" guard. A snapshot mismatch means the rendered tree (classes, order,
 * a11y labels) drifted — which is what catches accidental layout regressions
 * in viewport bar, sidebar nav buttons, and the bottom timeline clock.
 *
 * Files under guard:
 *   - src/components/editor/ViewportBar.tsx        (top viewport toolbar)
 *   - src/components/editor/ViewportNavControls.tsx (right sidebar nav)
 *   - src/components/editor/TimelineClockPanel.tsx (bottom timeline clock)
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';

import ViewportBar from '../ViewportBar';
import ViewportNavControls from '../ViewportNavControls';
import TimelineClockPanel from '../TimelineClockPanel';

beforeAll(() => {
  // Force dark mode for every render in this file.
  document.documentElement.classList.add('dark');
});

afterEach(() => {
  cleanup();
});

function renderInDark(ui: React.ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe('Editor layout — visual regression (dark mode)', () => {
  it('ViewportBar (top toolbar) matches snapshot + uses dark tokens', () => {
    const { container } = renderInDark(<ViewportBar />);
    const root = container.firstChild as HTMLElement;
    expect(root).toMatchSnapshot();
    // Semantic guards: dark-mode design tokens must be present.
    expect(root.className).toMatch(/bg-card\/85/);
    expect(root.className).toMatch(/border-border\/25/);
  });

  it('ViewportNavControls (right sidebar) matches snapshot + has a11y labels', () => {
    const { container } = renderInDark(<ViewportNavControls />);
    expect(container.firstChild).toMatchSnapshot();
    // Every nav button must expose an aria-label for screen readers.
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((b) => expect(b.getAttribute('aria-label')).toBeTruthy());
  });

  it('TimelineClockPanel (bottom timeline) matches snapshot + uses muted tokens', () => {
    const { container } = renderInDark(<TimelineClockPanel />);
    const root = container.firstChild as HTMLElement;
    expect(root).toMatchSnapshot();
    expect(root.className).toMatch(/bg-background\/40/);
    expect(root.className).toMatch(/border-border\/20/);
  });

  it('document root has the dark class applied', () => {
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
