import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadExtensionHistory,
  saveExtensionHistory,
  clearExtensionHistory,
} from '../extensionHistoryStorage';
import type { ShowPlan, ShowSiteConfig } from '../types';
import { diffShowPlan } from '../showPlanDiff';

const site: ShowSiteConfig = {
  name: 'T', width: 100, depth: 100, maxHeight: 80,
  safetyDistance: 15, audiencePosition: 'front', showType: 'hybrid',
};
const basePlan: ShowPlan = {
  id: 'plan-1', title: 'p', duration: 10, intent: '', style: '',
  site, sections: [], positions: [], timelineItems: [], trajectories: [],
  safetyWarnings: [], assumptions: [],
};

describe('extensionHistoryStorage', () => {
  beforeEach(() => { window.localStorage.clear(); });

  it('returns null when nothing stored', () => {
    expect(loadExtensionHistory('plan-1')).toBeNull();
  });

  it('round-trips history+redo by planId', () => {
    const entry = {
      id: 'e1', timestamp: 1, prompt: 'p', anchorLabel: 'last',
      resumeAt: 10, providerId: 'local', fellBack: false,
      prevPlan: basePlan, diff: diffShowPlan(basePlan, basePlan),
    };
    saveExtensionHistory('plan-1', { history: [entry], redo: [] });
    const loaded = loadExtensionHistory('plan-1');
    expect(loaded?.history).toHaveLength(1);
    expect(loaded?.history[0].id).toBe('e1');
  });

  it('isolates by planId', () => {
    saveExtensionHistory('a', { history: [], redo: [] });
    expect(loadExtensionHistory('b')).toBeNull();
  });

  it('clears the slot', () => {
    saveExtensionHistory('plan-1', { history: [], redo: [] });
    clearExtensionHistory('plan-1');
    expect(loadExtensionHistory('plan-1')).toBeNull();
  });
});
