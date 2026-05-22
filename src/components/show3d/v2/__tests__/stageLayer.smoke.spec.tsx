/**
 * StageLayer — smoke test.
 *
 * Como jsdom não tem WebGL, validamos:
 *   1. Flag default = ON.
 *   2. Override localStorage '0' desliga.
 *   3. StageLayer importa sem throw e exporta os 2 variants.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { isSkycanvasV2StageEnabled } from '@/lib/featureFlags';
import { StageLayer } from '@/components/show3d/v2/StageLayer';

describe('SkyCanvas 2.0 — StageLayer', () => {
  beforeEach(() => {
    try { localStorage.removeItem('fxk.flag.skycanvas_v2_stage'); } catch { /* noop */ }
  });

  it('flag default ON', () => {
    expect(isSkycanvasV2StageEnabled()).toBe(true);
  });

  it('localStorage override desliga', () => {
    localStorage.setItem('fxk.flag.skycanvas_v2_stage', '0');
    expect(isSkycanvasV2StageEnabled()).toBe(false);
    localStorage.setItem('fxk.flag.skycanvas_v2_stage', '1');
    expect(isSkycanvasV2StageEnabled()).toBe(true);
  });

  it('StageLayer é função e aceita props variantes', () => {
    expect(typeof StageLayer).toBe('function');
    const arch = StageLayer({ variant: 'arch' });
    const minimal = StageLayer({ variant: 'minimal' });
    expect(arch).toBeTruthy();
    expect(minimal).toBeTruthy();
  });
});
