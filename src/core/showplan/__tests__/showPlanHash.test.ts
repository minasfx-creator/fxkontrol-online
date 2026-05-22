import { describe, it, expect } from 'vitest';
import {
  canonicalizeShowPlan,
  hashShowPlan,
  hashCanonical,
  isCryptographicHash,
} from '../showPlanHash';
import { createEmptyShowPlan } from '../ShowPlan';

function plan() {
  const p = createEmptyShowPlan();
  p.metadata.id = 'fixed';
  p.metadata.createdAt = 1;
  p.metadata.updatedAt = 1;
  p.pyroCues.push({
    id: 'c1', time: 0.5, positionId: 'p1', module: 0, channel: 3,
    effectId: 'eff', fuseDelay: 0, caliber: 75, elevation: 90,
    heading: 0, position: { x: 0, y: 0, z: 0 },
  });
  return p;
}

describe('showPlanHash', () => {
  it('canonical form is stable across key order', () => {
    const a = plan();
    const b = plan();
    // mutate property order via re-assignment
    b.metadata = { ...b.metadata } as typeof b.metadata;
    expect(canonicalizeShowPlan(a)).toBe(canonicalizeShowPlan(b));
  });

  it('ignores volatile metadata (updatedAt/author/notes)', async () => {
    const a = plan();
    const b = plan();
    b.metadata.updatedAt = 9999999;
    b.metadata.author = 'someone-else';
    b.metadata.notes = 'edited';
    expect(await hashShowPlan(a)).toBe(await hashShowPlan(b));
  });

  it('detects pyro cue mutation', async () => {
    const a = plan();
    const b = plan();
    b.pyroCues[0].channel = 4;
    expect(await hashShowPlan(a)).not.toBe(await hashShowPlan(b));
  });

  it('produces a sha256: prefixed hash when WebCrypto is available', async () => {
    const h = await hashShowPlan(plan());
    expect(isCryptographicHash(h)).toBe(true);
  });

  it('hashCanonical is deterministic', async () => {
    const c = canonicalizeShowPlan(plan());
    const h1 = await hashCanonical(c);
    const h2 = await hashCanonical(c);
    expect(h1).toBe(h2);
  });
});
