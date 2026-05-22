import { describe, it, expect } from 'vitest';
import { bengalDurationFromName, selectBengalSilhouette } from '../bengalSilhouettes';

describe('bengalSilhouettes', () => {
  it('parses duration from (NNs) suffix', () => {
    expect(bengalDurationFromName('Bengal Light Red (30s).fwe')).toBe(30);
    expect(bengalDurationFromName('Bengal Aqua (05s)')).toBe(5);
    expect(bengalDurationFromName('Bengal Blue')).toBeNull();
  });
  it('defaults to 5s and disables halo for short flares', () => {
    const s = selectBengalSilhouette('Bengal Pink');
    expect(s.durationS).toBe(5);
    expect(s.jets).toBe(1);
    expect(s.groundHalo).toBe(false);
  });
  it('enables ground halo for long-burning bengals (>= 10s)', () => {
    expect(selectBengalSilhouette('Bengal Red (10s)').groundHalo).toBe(true);
    expect(selectBengalSilhouette('Bengal Red (30s)').groundHalo).toBe(true);
  });
});
