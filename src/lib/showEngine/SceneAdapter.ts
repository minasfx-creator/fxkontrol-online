/**
 * SceneAdapter — pure ShowPlan → SceneGraph mapper.
 *
 * No Three.js types. Output is a plain data structure consumed by
 * Show3DEngine (which builds meshes) and by validators/tests.
 *
 * This is the decoupling layer: ShowPlan never reaches Three.js directly.
 */

import type { PlannedPosition, ShowPlan, ShowSiteConfig } from '@/lib/aiShowBuilder/types';

export type Vec3 = { x: number; y: number; z: number };

export interface SiteNode {
  width: number;
  depth: number;
  maxHeight: number;
  center: Vec3;
}

export interface PositionNode {
  id: string;
  name: string;
  kind: 'drone' | 'pyro' | 'anchor';
  position: Vec3;
  color: string;
}

export interface DroneNode {
  id: string;
  position: Vec3;
}

export interface PyroNode {
  id: string;
  position: Vec3;
  color: string;
}

export interface SceneGraph {
  site: SiteNode;
  positions: PositionNode[];
  drones: DroneNode[];
  pyro: PyroNode[];
  /** Total renderable node count, useful for validators/diagnostics. */
  totalNodes: number;
}

function siteNode(site: ShowSiteConfig): SiteNode {
  return {
    width: site.width,
    depth: site.depth,
    maxHeight: site.maxHeight,
    center: { x: 0, y: 0, z: 0 },
  };
}

function positionNode(p: PlannedPosition): PositionNode {
  return {
    id: p.id,
    name: p.name,
    kind: p.type,
    position: { x: p.x, y: p.y, z: p.z },
    color: p.color,
  };
}

export function adaptShowPlanToSceneGraph(plan: ShowPlan): SceneGraph {
  const site = siteNode(plan.site);
  const positions = plan.positions.map(positionNode);
  const drones = positions
    .filter((p) => p.kind === 'drone')
    .map<DroneNode>((p) => ({ id: `drone-${p.id}`, position: p.position }));
  const pyro = positions
    .filter((p) => p.kind === 'pyro')
    .map<PyroNode>((p) => ({ id: `pyro-${p.id}`, position: p.position, color: p.color }));

  return {
    site,
    positions,
    drones,
    pyro,
    totalNodes: 1 + positions.length + drones.length + pyro.length,
  };
}
