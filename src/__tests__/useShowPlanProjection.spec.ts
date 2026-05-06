import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShowPlanProjection } from '@/hooks/useShowPlanProjection';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { createEmptyShowPlan } from '@/core/showplan/ShowPlan';
import { useProjectStore } from '@/store/useProjectStore';

describe('useShowPlanProjection', () => {
  it('returns the canonical ShowPlan from showPlanManager', () => {
    const sp = createEmptyShowPlan();
    sp.metadata.name = 'Projection Test';
    showPlanManager.load(sp);
    const { result } = renderHook(() => useShowPlanProjection());
    expect(result.current.plan.metadata.name).toBe('Projection Test');
    expect(result.current.pyroCueCount).toBe(0);
    expect(result.current.dmxCueCount).toBe(0);
    expect(result.current.universeIds).toEqual([]);
  });

  it('keeps a stable reference between renders when nothing changes', () => {
    const { result, rerender } = renderHook(() => useShowPlanProjection());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('recomputes when the project store mutates', () => {
    const { result } = renderHook(() => useShowPlanProjection());
    const before = result.current;
    act(() => {
      useProjectStore.setState((s) => ({
        positions: [
          ...s.positions,
          { id: 'p-test', name: 'Test', type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 0 } as any,
        ],
      }));
    });
    expect(result.current).not.toBe(before);
  });
});
