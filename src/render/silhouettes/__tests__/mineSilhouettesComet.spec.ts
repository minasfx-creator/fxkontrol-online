import { describe, it, expect } from 'vitest';
import { MINE_SILHOUETTES, selectMineSilhouette } from '@/render/silhouettes/mineSilhouettes';

describe('Mine silhouette — comet variant', () => {
  it('mine_comet_with_silver_tail exists with single jet + low jitter + silverTail', () => {
    const v = MINE_SILHOUETTES.mine_comet_with_silver_tail;
    expect(v.jetAnglesDeg).toEqual([0]);
    expect(v.jitterDeg).toBeLessThanOrEqual(2);
    expect(v.silverTail).toBe(true);
  });

  it('selectMineSilhouette honors cometHead override', () => {
    const s = selectMineSilhouette({ caliber: 6, cometHead: true });
    expect(s.id).toBe('mine_comet_with_silver_tail');
  });

  it('non-comet selection still hits 7jet for caliber 3', () => {
    expect(selectMineSilhouette({ caliber: 3 }).id).toBe('mine_7jet');
  });
});
