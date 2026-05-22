import { describe, expect, it } from 'vitest';
import {
  compileTimeline,
  cuesActivatedBetween,
  cuesAt,
} from '@/lib/showEngine/timelineCompiler';
import { localShowPlanProvider } from '@/lib/aiShowBuilder/localShowPlanProvider';
import type { ShowSiteConfig } from '@/lib/aiShowBuilder/types';

const SITE: ShowSiteConfig = {
  name: 'T', width: 200, depth: 100, maxHeight: 80,
  safetyDistance: 20, audiencePosition: 'front', showType: 'hybrid',
};

describe('timelineCompiler', () => {
  it('compiles to sorted, deterministic cues', async () => {
    const plan = await localShowPlanProvider.generate({ prompt: 'show de 30s', site: SITE, variationSeed: 2 });
    const t = compileTimeline(plan);
    expect(t.duration).toBe(plan.duration);
    expect(t.cues.length).toBe(plan.timelineItems.length);
    for (let i = 1; i < t.cues.length; i++) {
      expect(t.cues[i].startTime).toBeGreaterThanOrEqual(t.cues[i - 1].startTime);
    }
  });

  it('cuesActivatedBetween returns only newly active cues (incremental playback)', async () => {
    const plan = await localShowPlanProvider.generate({ prompt: '30s', site: SITE, variationSeed: 3 });
    const t = compileTimeline(plan);
    const all = cuesActivatedBetween(t, 0, plan.duration);
    expect(all.length).toBeGreaterThan(0);
    // Empty interval returns nothing
    expect(cuesActivatedBetween(t, 5, 5)).toHaveLength(0);
    // Reverse interval returns nothing
    expect(cuesActivatedBetween(t, 10, 5)).toHaveLength(0);
  });

  it('cuesAt is idempotent — same time always returns same set (scrub determinism)', async () => {
    const plan = await localShowPlanProvider.generate({ prompt: '30s', site: SITE, variationSeed: 4 });
    const t = compileTimeline(plan);
    const sample = Math.min(2, t.duration);
    const a = cuesAt(t, sample);
    const b = cuesAt(t, sample);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
});
