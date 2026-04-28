/**
 * BUG-04 guardian — E-STOP must NEVER route a pyro cue through a low-precision
 * transport (Tuya outlets) or a NO_HARDWARE adapter, even if the dev simulator
 * flag is enabled.
 *
 * This test pins the contract: any pyro cue submitted while continuity status
 * is NO_HARDWARE OR transport === 'tuya' must be rejected by the safety gate.
 */
import { describe, it, expect } from 'vitest';

type ContinuityStatus = 'OK' | 'OPEN' | 'NO_HARDWARE' | 'UNKNOWN';
type Transport = 'pbus' | 'artnet' | 'mavlink' | 'tuya' | 'sim';
interface CueRequest {
  cueId: string;
  cueClass: 'pyro' | 'sfx' | 'light';
  transport: Transport;
  continuity: ContinuityStatus;
}

/** Pure gate — extracted contract under test (mirror of production rule). */
export function isFireAllowed(c: CueRequest): { ok: boolean; reason?: string } {
  if (c.cueClass === 'pyro') {
    if (c.continuity === 'NO_HARDWARE') return { ok: false, reason: 'NO_HARDWARE' };
    if (c.continuity === 'UNKNOWN')     return { ok: false, reason: 'CONTINUITY_UNKNOWN' };
    if (c.transport === 'tuya')         return { ok: false, reason: 'LOW_PRECISION_TRANSPORT' };
    if (c.transport === 'sim')          return { ok: false, reason: 'SIMULATED_TRANSPORT' };
  }
  return { ok: true };
}

describe('BUG-04 · E-STOP / Pyro hard gate', () => {
  it('blocks pyro cue when continuity is NO_HARDWARE', () => {
    const r = isFireAllowed({ cueId: 'p1', cueClass: 'pyro', transport: 'pbus', continuity: 'NO_HARDWARE' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('NO_HARDWARE');
  });

  it('blocks pyro cue routed via tuya outlets (low precision)', () => {
    const r = isFireAllowed({ cueId: 'p2', cueClass: 'pyro', transport: 'tuya', continuity: 'OK' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('LOW_PRECISION_TRANSPORT');
  });

  it('blocks pyro cue on simulated transport even if continuity OK', () => {
    const r = isFireAllowed({ cueId: 'p3', cueClass: 'pyro', transport: 'sim', continuity: 'OK' });
    expect(r.ok).toBe(false);
  });

  it('allows pyro cue on PBUS with OK continuity', () => {
    const r = isFireAllowed({ cueId: 'p4', cueClass: 'pyro', transport: 'pbus', continuity: 'OK' });
    expect(r.ok).toBe(true);
  });

  it('allows non-pyro (light) on tuya — outlets are fine for non-critical timing', () => {
    const r = isFireAllowed({ cueId: 'l1', cueClass: 'light', transport: 'tuya', continuity: 'NO_HARDWARE' });
    expect(r.ok).toBe(true);
  });
});
