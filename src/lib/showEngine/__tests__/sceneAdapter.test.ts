import { describe, expect, it } from 'vitest';
import { adaptShowPlanToSceneGraph } from '@/lib/showEngine/SceneAdapter';
import {
  validateSceneGraph,
  validateViewportRenderable,
} from '@/lib/showEngine/validateSceneGraph';
import { localShowPlanProvider } from '@/lib/aiShowBuilder/localShowPlanProvider';
import type { ShowSiteConfig } from '@/lib/aiShowBuilder/types';

const SITE: ShowSiteConfig = {
  name: 'Test',
  width: 200,
  depth: 100,
  maxHeight: 80,
  safetyDistance: 20,
  audiencePosition: 'front',
  showType: 'hybrid',
};

describe('SceneAdapter + validators', () => {
  it('produces a deterministic graph from a deterministic plan', async () => {
    const a = await localShowPlanProvider.generate({ prompt: 'finale dourado', site: SITE, variationSeed: 0 });
    const b = await localShowPlanProvider.generate({ prompt: 'finale dourado', site: SITE, variationSeed: 0 });
    const ga = adaptShowPlanToSceneGraph(a);
    const gb = adaptShowPlanToSceneGraph(b);
    expect(ga).toEqual(gb);
  });

  it('non-empty graph passes validateSceneGraph', async () => {
    const plan = await localShowPlanProvider.generate({ prompt: '12 posições em linha', site: SITE, variationSeed: 1 });
    const graph = adaptShowPlanToSceneGraph(plan);
    const res = validateSceneGraph(graph);
    expect(res.ok).toBe(true);
    expect(graph.totalNodes).toBeGreaterThan(1);
  });

  it('flags zero-sized site as invalid', () => {
    const graph = adaptShowPlanToSceneGraph({
      id: 'x',
      title: '',
      duration: 0,
      intent: '',
      style: '',
      site: { ...SITE, width: 0, depth: 0, maxHeight: 0 },
      sections: [],
      positions: [],
      timelineItems: [],
      trajectories: [],
      safetyWarnings: [],
      assumptions: [],
    });
    const res = validateSceneGraph(graph);
    expect(res.ok).toBe(false);
  });

  it('flags zero-children scene as black viewport', () => {
    const res = validateViewportRenderable({
      rendererWidth: 800,
      rendererHeight: 600,
      cameraAspect: 800 / 600,
      cameraPosition: { x: 0, y: 10, z: 20 },
      sceneChildrenCount: 0,
    });
    expect(res.ok).toBe(false);
    expect(res.errors.join(' ')).toMatch(/black/i);
  });

  it('passes a valid renderable viewport', () => {
    const res = validateViewportRenderable({
      rendererWidth: 1280,
      rendererHeight: 720,
      cameraAspect: 1280 / 720,
      cameraPosition: { x: 0, y: 50, z: 100 },
      sceneChildrenCount: 5,
    });
    expect(res.ok).toBe(true);
  });
});
