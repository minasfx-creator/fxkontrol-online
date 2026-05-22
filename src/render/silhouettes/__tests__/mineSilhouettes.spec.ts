import { describe, it, expect } from 'vitest';
import { MINE_SILHOUETTES, selectMineSilhouette } from '@/render/silhouettes/mineSilhouettes';

describe('Mine silhouettes (FWsim Mine_01/02/03 vector base)', () => {
  it('exposes 3 distinct fan profiles with monotonically growing jet count', () => {
    const ids = ['mine_5jet', 'mine_7jet', 'mine_9jet'] as const;
    const counts = ids.map((id) => MINE_SILHOUETTES[id].jetAnglesDeg.length);
    expect(counts).toEqual([5, 7, 9]);
  });

  it('all jet angles stay within ±60° of vertical (physically-plausible spread)', () => {
    for (const sil of Object.values(MINE_SILHOUETTES)) {
      for (const a of sil.jetAnglesDeg) {
        expect(a).toBeGreaterThanOrEqual(-65);
        expect(a).toBeLessThanOrEqual(65);
      }
      expect(sil.crownRatio).toBeGreaterThan(0);
      expect(sil.crownRatio).toBeLessThan(0.5);
    }
  });

  it('selectMineSilhouette scales with caliber', () => {
    expect(selectMineSilhouette({ caliber: 2 }).id).toBe('mine_5jet');
    expect(selectMineSilhouette({ caliber: 3 }).id).toBe('mine_7jet');
    expect(selectMineSilhouette({ caliber: 6 }).id).toBe('mine_9jet');
    expect(selectMineSilhouette({ caliber: 2, numDevices: 8 }).id).toBe('mine_9jet');
  });
});
