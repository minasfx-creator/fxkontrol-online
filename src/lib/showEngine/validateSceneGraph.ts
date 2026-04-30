/**
 * Renderability validators. Independent from `validateShowPlan` — these
 * answer "would this actually render?" rather than "is the data valid?".
 */
import type { SceneGraph, Vec3 } from './SceneAdapter';

export interface RenderabilityResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function isFiniteVec3(v: Vec3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

export function validateSceneGraph(graph: SceneGraph): RenderabilityResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (graph.totalNodes <= 1) {
    warnings.push('Scene has no positions or effects — only site bounds will render.');
  }
  if (!(graph.site.width > 0) || !(graph.site.depth > 0) || !(graph.site.maxHeight > 0)) {
    errors.push('Site bounds must be positive on all axes.');
  }
  for (const p of graph.positions) {
    if (!isFiniteVec3(p.position)) {
      errors.push(`Position "${p.name}" has non-finite coordinates.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export interface RenderableViewport {
  rendererWidth: number;
  rendererHeight: number;
  cameraAspect: number;
  cameraPosition: Vec3;
  sceneChildrenCount: number;
}

export function validateViewportRenderable(v: RenderableViewport): RenderabilityResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(v.rendererWidth > 0) || !(v.rendererHeight > 0)) {
    errors.push('Renderer size must be > 0 on both axes.');
  }
  if (!Number.isFinite(v.cameraAspect) || v.cameraAspect <= 0) {
    errors.push('Camera aspect must be a finite positive number.');
  }
  if (!isFiniteVec3(v.cameraPosition)) {
    errors.push('Camera position must be finite.');
  }
  if (v.sceneChildrenCount <= 0) {
    errors.push('Scene has zero children — viewport would be black.');
  }

  return { ok: errors.length === 0, errors, warnings };
}
