/**
 * Guard: controllerRegistry maps FXK32Q family strings to kind 'fxk32q'
 * (more specific than the generic FXK16 rule), without regressing FXK16.
 */
import { describe, it, expect } from 'vitest';
import { resolveControllerProfile, getProfile } from '@/core/discovery/controllerRegistry';
import type { PhysicalDevice } from '@/core/discovery/types';

function devWithFamily(family: string, label = ''): PhysicalDevice {
  return {
    aggregateId: `agg:${family}`,
    label: label || family,
    online: true,
    activeTransport: 'webserial',
    links: {
      webserial: {
        transport: 'webserial',
        family,
        connected: true,
        lastSeen: Date.now(),
      } as any,
    } as any,
  } as unknown as PhysicalDevice;
}

describe('controllerRegistry — FXK32Q', () => {
  it('exposes fxk32q profile with safety-critical caps and /field#fxk32q route', () => {
    const p = getProfile('fxk32q');
    expect(p.kind).toBe('fxk32q');
    expect(p.capabilities.safetyCritical).toBe(true);
    expect(p.consoleRoute).toBe('/field#fxk32q');
  });

  it.each([
    'FXK32Q',
    'fxk32q',
    'fxk-32',
    'fxk 32 q',
    'IFMx-i32Q',
    'IFMx i32q',
  ])('classifies %s as fxk32q', (family) => {
    expect(resolveControllerProfile(devWithFamily(family)).kind).toBe('fxk32q');
  });

  it('does not regress FXK16 classification', () => {
    expect(resolveControllerProfile(devWithFamily('fxk-16')).kind).toBe('fxk16');
    expect(resolveControllerProfile(devWithFamily('FXKPYRO')).kind).toBe('fxk16');
  });

  it('unknown families remain unknown (no auto-promotion)', () => {
    expect(resolveControllerProfile(devWithFamily('mystery-mcu')).kind).toBe('unknown');
  });
});
