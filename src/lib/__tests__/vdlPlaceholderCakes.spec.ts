import { describe, it, expect } from 'vitest';
import { parseVDL } from '../vdlParser';

/**
 * VDL Placeholder Cakes — pins parser behavior against the May 29, 2024
 * "Creating or importing a simple 'placeholder' cake simulation" doc.
 * See docs/reference/vdl-placeholder-cakes.md.
 */
describe('VDL Placeholder Cakes (Table 1)', () => {
  it('canonical: size + N Shot + Ns + effect + Cake + Z-Shape', () => {
    const r = parseVDL('30mm 49 Shot 10s Time Rain Comet Cake Z-Shape');
    expect(r.type).toBe('cake');
    expect(r.shotCount).toBe(49);
    expect(r.cakeDuration).toBe(10);
    expect(r.firingPattern).toBe('z-shape');
    expect(r.isAerial).toBe(false);
  });

  it('full metrics in description: PFT + height also parse', () => {
    const r = parseVDL('30mm 49 Shot 10s 2.1s PFT 90m Multi-Color Peony Cake Z-Shape');
    expect(r.type).toBe('cake');
    expect(r.shotCount).toBe(49);
    expect(r.cakeDuration).toBe(10);
    expect(r.firingPattern).toBe('z-shape');
    // typed lookups feed prefire/height; just sanity-check non-zero presence
    expect(r.prefire).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });

  it('CSV-style (metrics columned away): description still resolves cake + pattern', () => {
    const r = parseVDL('49 Shot Multi-Color Peony Cake Z-Shape');
    expect(r.type).toBe('cake');
    expect(r.shotCount).toBe(49);
    expect(r.firingPattern).toBe('z-shape');
  });

  it('firing pattern: Fan (simultaneous per row)', () => {
    const r = parseVDL('30mm 16 Shot 6s Peony Cake Fan');
    expect(r.firingPattern).toBe('fan');
  });

  it('firing pattern: FNR (fan-to-right-in-sequence, distinct from Fan)', () => {
    const r = parseVDL('30mm 16 Shot 6s Peony Cake FNR');
    expect(r.firingPattern).toBe('fnr');
  });

  it('firing pattern: X-Shape', () => {
    const r = parseVDL('30mm 20 Shot 8s Peony Cake X-Shape');
    expect(r.firingPattern).toBe('x-shape');
  });

  it('firing pattern blank = straight up', () => {
    const r = parseVDL('30mm 10 Shot 5s Peony Cake');
    expect(r.type).toBe('cake');
    expect(r.firingPattern).toBe('');
  });

  it('Aerial keyword forces shell interpretation', () => {
    const r = parseVDL('50mm 10 Shot Aerial Time Rain Cake');
    expect(r.type).toBe('cake');
    expect(r.isAerial).toBe(true);
  });

  it('No Aerial/Shell keyword → rising-effect default (isAerial=false)', () => {
    const r = parseVDL('50mm 10 Shot Time Rain Cake');
    expect(r.type).toBe('cake');
    expect(r.isAerial).toBe(false);
  });

  it('N Rows override is captured as cakeRows', () => {
    const r = parseVDL('30mm 30 Shot 9s Peony Cake Fan 3 Rows');
    expect(r.cakeRows).toBe(3);
    expect(r.firingPattern).toBe('fan');
  });

  it('≤10 shots without explicit Rows leaves cakeRows at default 0 (slice-cake implied by doc, not by parser field)', () => {
    const r = parseVDL('30mm 10 Shot 5s Peony Cake');
    expect(r.shotCount).toBe(10);
    expect(r.cakeRows).toBe(0);
  });
});
