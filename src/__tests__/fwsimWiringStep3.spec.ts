/**
 * FWsim Wiring Step 3/5 — r_fwsim_tonemapping
 *
 * Pins the contract that ACESHuePreserveEffect accepts FWsim's
 * TonemappingConfig (Contrast 1.7, HdrMax 16) as additive uniforms,
 * with neutral defaults that reproduce legacy behavior when OFF.
 */
import { describe, it, expect } from 'vitest';
import { isEnabled } from '@/lib/featureFlags';
import { getFwsimGraphics } from '@/data/fwsimGraphicsConfig';
import { ACESHuePreserveEffect } from '@/render_ultra/postprocessing/acesHuePreserve';

describe('FWsim Wiring Step 3 — r_fwsim_tonemapping', () => {
  it('flag defaults ON', () => {
    expect(isEnabled('r_fwsim_tonemapping')).toBe(true);
  });

  it('canonical FWsim tonemapping values match graphics.xml', () => {
    const tm = getFwsimGraphics().tonemapping;
    expect(tm.contrast).toBe(1.7);
    expect(tm.hdrMax).toBe(16);
  });

  it('ACESHuePreserveEffect exposes fwsimContrast + fwsimHdrMax uniforms with neutral defaults', () => {
    const fx = new ACESHuePreserveEffect();
    const cu = fx.uniforms.get('fwsimContrast');
    const hu = fx.uniforms.get('fwsimHdrMax');
    expect(cu).toBeTruthy();
    expect(hu).toBeTruthy();
    expect((cu as { value: number }).value).toBe(1.0); // neutral
    expect((hu as { value: number }).value).toBe(0.0); // disabled
  });

  it('accepts FWsim canonical values via constructor', () => {
    const tm = getFwsimGraphics().tonemapping;
    const fx = new ACESHuePreserveEffect({ fwsimContrast: tm.contrast, fwsimHdrMax: tm.hdrMax });
    expect((fx.uniforms.get('fwsimContrast') as { value: number }).value).toBe(1.7);
    expect((fx.uniforms.get('fwsimHdrMax') as { value: number }).value).toBe(16);
  });

  it('setters update uniforms live', () => {
    const fx = new ACESHuePreserveEffect();
    fx.fwsimContrast = 1.7;
    fx.fwsimHdrMax = 16;
    expect((fx.uniforms.get('fwsimContrast') as { value: number }).value).toBe(1.7);
    expect((fx.uniforms.get('fwsimHdrMax') as { value: number }).value).toBe(16);
  });

  it('legacy 3 uniforms unchanged (exposure, huePreserveStrength, highlightThreshold)', () => {
    const fx = new ACESHuePreserveEffect();
    expect((fx.uniforms.get('exposure') as { value: number }).value).toBe(1.0);
    expect((fx.uniforms.get('huePreserveStrength') as { value: number }).value).toBe(0.7);
    expect((fx.uniforms.get('highlightThreshold') as { value: number }).value).toBe(1.5);
  });
});
