/**
 * Guard: FieldOps shows the FXK32Q tab only when either
 *   (a) the localStorage flag fxk.flag.fxk32q_fieldops is ON, or
 *   (b) useActiveControllers reports a controller of kind 'fxk32q' online.
 * Otherwise the tab MUST NOT render — keeps the field console honest
 * (no mock pyro hardware exposed).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Stub deferred-loaded panels so Suspense resolves immediately and we
// don't pull in three.js / hardware singletons.
vi.mock('@/components/field/DevicePairingPanel', () => ({ default: () => <div /> }));
vi.mock('@/components/command/FieldTestPanel',  () => ({ default: () => <div /> }));
vi.mock('@/components/editor/MobileLinkPanel',   () => ({ default: () => <div /> }));
vi.mock('@/components/field/FXK16FieldPanel',    () => ({ default: () => <div /> }));
vi.mock('@/components/field/FXK32QFieldPanel',   () => ({ default: () => <div data-testid="fxk32q-panel" /> }));
vi.mock('@/features/fieldbus/FireOnePanel',      () => ({ default: () => <div /> }));

const controllersMock = vi.hoisted(() => ({ list: [] as Array<{ profile: { kind: string } }> }));
vi.mock('@/hooks/useActiveControllers', () => ({
  useActiveControllers: () => ({
    controllers: controllersMock.list,
    pending: [],
    acknowledge: () => {},
    close: () => {},
  }),
}));

import FieldOpsPage from '@/pages/FieldOps';

function renderField() {
  return render(
    <MemoryRouter>
      <FieldOpsPage />
    </MemoryRouter>
  );
}

describe('FieldOps — FXK32Q tab visibility', () => {
  beforeEach(() => {
    cleanup();
    controllersMock.list = [];
    try { window.localStorage.removeItem('fxk.flag.fxk32q_fieldops'); } catch {}
    if (typeof window !== 'undefined') window.history.replaceState(null, '', '/');
  });

  it('hides the FXK32Q tab when no flag and no live controller', () => {
    renderField();
    expect(screen.queryByRole('button', { name: /FXK32Q/i })).toBeNull();
  });

  it('shows the FXK32Q tab when fxk.flag.fxk32q_fieldops=1', () => {
    window.localStorage.setItem('fxk.flag.fxk32q_fieldops', '1');
    renderField();
    expect(screen.getByRole('button', { name: /FXK32Q/i })).toBeTruthy();
  });

  it('shows the FXK32Q tab when a controller of kind fxk32q is active', () => {
    controllersMock.list = [{ profile: { kind: 'fxk32q' } }];
    renderField();
    expect(screen.getByRole('button', { name: /FXK32Q/i })).toBeTruthy();
  });

  it('still hides the tab when only an unrelated controller is online', () => {
    controllersMock.list = [{ profile: { kind: 'fxk16' } }];
    renderField();
    expect(screen.queryByRole('button', { name: /FXK32Q/i })).toBeNull();
  });
});
