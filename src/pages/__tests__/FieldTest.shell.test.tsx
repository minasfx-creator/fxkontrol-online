/**
 * FieldTest polymorphic shell — integration tests
 *
 * Verifies that the unified `<FieldTest />` entry:
 *   1. mounts FieldTestMobile when `useIsMobile()` reports a touch device
 *   2. mounts the lazy FieldTestDesktop chunk on desktop viewports
 *   3. is the same module CommandCenter lazy-imports for `field_test`
 *
 * Heavy children (FXK16 panels, BLE scanner) are exercised at the import
 * boundary only; their internals are mocked to keep this test hermetic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React, { Suspense } from 'react';

// ─── Mocks ──────────────────────────────────────────
const mockIsMobile = vi.fn(() => false);
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockIsMobile(),
}));

vi.mock('@/components/editor/FieldTestDesktop', () => ({
  default: () => <div data-testid="desktop-shell">DESKTOP_SHELL</div>,
}));

// Sub-panels referenced by FieldTestMobile setup screen — keep them inert.
vi.mock('@/components/field/FXK16FieldTestPanel', () => ({ default: () => null }));
vi.mock('@/components/field/FXK16FieldSettingsPanel', () => ({ default: () => null }));
vi.mock('@/components/editor/live-firing/FXK16ConnectionPanel', () => ({
  FXK16ConnectionPanel: () => null,
}));
vi.mock('@/services/bleFieldTransport', () => ({
  isWebBluetoothAvailable: () => false,
}));
// Field test engine: stable subscribe/no session.
vi.mock('@/services/fieldTestService', () => ({
  fieldTestEngine: {
    subscribe: (_fn: unknown) => () => {},
    start: vi.fn(),
    stop: vi.fn(),
    arm: vi.fn(),
    disarm: vi.fn(),
    eStop: vi.fn(),
    fire: vi.fn(),
    runBenchmark: vi.fn(),
    stopBenchmark: vi.fn(),
    generateReport: () => '',
    getSuggestions: () => [],
    get currentSession() { return null; },
  },
  generateSessionCode: () => 'TEST',
}));

const renderWithRouter = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
    </MemoryRouter>,
  );

describe('FieldTest polymorphic entry', () => {
  beforeEach(() => {
    mockIsMobile.mockReset();
  });

  it('renders the mobile shell on touch / narrow devices', async () => {
    mockIsMobile.mockReturnValue(true);
    const { default: FieldTest } = await import('@/pages/FieldTest');
    renderWithRouter(<FieldTest />);
    // Header only present in the mobile shell ("FIELD TEST" + back button).
    // Mobile shell renders the setup screen header. Multiple matches are
    // fine — the absence of the desktop shell is the discriminator.
    const matches = await screen.findAllByText(/FIELD TEST/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.queryByTestId('desktop-shell')).not.toBeInTheDocument();
  });

  it('lazy-mounts the desktop shell on desktop devices', async () => {
    mockIsMobile.mockReturnValue(false);
    const { default: FieldTest } = await import('@/pages/FieldTest');
    renderWithRouter(<FieldTest />);
    expect(await screen.findByTestId('desktop-shell')).toBeInTheDocument();
  });
});

describe('CommandCenter ↔ FieldTest contract', () => {
  it('CommandCenter source imports the unified FieldTest entry', async () => {
    // Static contract check: any change to the import path will fail loudly.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/CommandCenter.tsx'),
      'utf8',
    );
    expect(src).toMatch(/import\(['"]@\/pages\/FieldTest['"]\)/);
  });
});
