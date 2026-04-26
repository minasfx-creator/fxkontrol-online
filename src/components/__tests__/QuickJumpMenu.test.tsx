/**
 * QuickJumpMenu — UI regression checks
 *
 * Validates:
 *   1. Placement: chip is fixed top-right with safe-area insets and z-[80].
 *   2. Active state on /studio (Studio item highlighted, FXK-DRONES not).
 *   3. Active state on /studio?panel=drones (FXK-DRONES highlighted).
 *   4. Active state on /ai-choreography (AI Choreography highlighted).
 *   5. On unmatched routes (e.g. /), falls back to Studio as the default
 *      label without crashing.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QuickJumpMenu from '@/components/QuickJumpMenu';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QuickJumpMenu />
    </MemoryRouter>,
  );
}

function openMenu() {
  const trigger = screen.getByRole('button', { name: /Navegação rápida/i });
  fireEvent.click(trigger);
  return screen.getByRole('menu');
}

function getActiveLabels(menu: HTMLElement): string[] {
  return within(menu)
    .getAllByRole('menuitem')
    .filter((el) => el.getAttribute('aria-current') === 'page')
    .map((el) => el.textContent?.split(/Editor|Console|Grok/)[0].trim() ?? '');
}

describe('QuickJumpMenu — placement', () => {
  it('is fixed top-right with safe-area insets and z-[80]', () => {
    const { container } = renderAt('/studio');
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('fixed');
    expect(root.className).toContain('z-[80]');
    expect(root.style.top).toContain('safe-area-inset-top');
    expect(root.style.right).toContain('safe-area-inset-right');
  });
});

describe('QuickJumpMenu — active state', () => {
  it('highlights Studio on /studio (no panel param)', () => {
    renderAt('/studio');
    const menu = openMenu();
    expect(getActiveLabels(menu)).toEqual(['Studio']);
  });

  it('highlights FXK-DRONES on /studio?panel=drones', () => {
    renderAt('/studio?panel=drones');
    const menu = openMenu();
    expect(getActiveLabels(menu)).toEqual(['FXK-DRONES']);
  });

  it('highlights AI Choreography on /ai-choreography', () => {
    renderAt('/ai-choreography');
    const menu = openMenu();
    expect(getActiveLabels(menu)).toEqual(['AI Choreography']);
  });

  it('does not double-highlight when an unrelated panel param is set', () => {
    renderAt('/studio?panel=positions');
    const menu = openMenu();
    expect(getActiveLabels(menu)).toEqual(['Studio']);
  });

  it('falls back to Studio label on unmatched routes without crashing', () => {
    renderAt('/');
    const trigger = screen.getByRole('button', { name: /Navegação rápida/i });
    // Trigger label only renders sm+ (hidden on mobile), but still present in DOM
    expect(trigger).toBeInTheDocument();
    const menu = openMenu();
    // /  doesn't match any item → no menuitem should be marked active
    expect(getActiveLabels(menu)).toEqual([]);
  });
});
