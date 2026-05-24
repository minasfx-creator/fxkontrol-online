/**
 * SkyCanvas 2.0 — smoke test.
 *
 * Não exercita WebGL real (jsdom não tem GPU). Valida o que importa para
 * evitar regressões de quedas:
 *   1. Boundary captura throw e renderiza fallback Vantablack.
 *   2. Reset volta a renderizar children.
 *   3. isSkycanvasV2Enabled responde corretamente ao localStorage override.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SkyCanvas2ErrorBoundary } from '@/components/show3d/v2/SkyCanvas2ErrorBoundary';
import { isSkycanvasV2Enabled } from '@/lib/featureFlags';

function Boom(): JSX.Element {
  throw new Error('synthetic-render-fault');
}

describe('SkyCanvas 2.0 — hardening', () => {
  beforeEach(() => {
    try { localStorage.removeItem('fxk.flag.skycanvas_v2'); } catch { /* noop */ }
  });

  it('boundary catches throw and renders fallback', () => {
    const { getByText } = render(
      <SkyCanvas2ErrorBoundary>
        <Boom />
      </SkyCanvas2ErrorBoundary>,
    );
    expect(getByText(/synthetic-render-fault/)).toBeTruthy();
    expect(getByText(/REINICIAR VIEWPORT/)).toBeTruthy();
  });

  it('reset re-mounts children when error is gone', () => {
    let throwIt = true;
    const Maybe = () => {
      if (throwIt) throw new Error('boom');
      return <div data-testid="ok">healed</div>;
    };
    const { getByText, queryByTestId } = render(
      <SkyCanvas2ErrorBoundary><Maybe /></SkyCanvas2ErrorBoundary>,
    );
    expect(queryByTestId('ok')).toBeNull();
    throwIt = false;
    fireEvent.click(getByText(/REINICIAR VIEWPORT/));
    expect(queryByTestId('ok')).toBeTruthy();
  });

  it('localStorage override flips skycanvas_v2 flag', () => {
    expect(isSkycanvasV2Enabled()).toBe(false); // static default
    localStorage.setItem('fxk.flag.skycanvas_v2', '1');
    expect(isSkycanvasV2Enabled()).toBe(true);
    localStorage.setItem('fxk.flag.skycanvas_v2', '0');
    expect(isSkycanvasV2Enabled()).toBe(false);
  });
});
