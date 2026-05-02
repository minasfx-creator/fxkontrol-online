/**
 * ─── Canonical ShowPlan → Engine ShowPlan adapter ───────────────────
 *
 * Bridges the gap between the **canonical** `ShowPlan`
 * (`@/core/showplan/ShowPlan`, source-of-truth for safety / verification /
 * export / hardware) and the **engine** `ShowPlan`
 * (`@/lib/aiShowBuilder/types`, what `Show3DEngine.loadPlan(plan)`
 * consumes for the cinematic 3D play loop).
 *
 * Pure, deterministic. NO Three.js, NO CommandBus. Used by `/dev/libertadores`
 * to feed the golden seed into the real engine for end-to-end ParticleGPGPU
 * + Smoke + Bloom validation in `simulation` workMode.
 *
 * Mapping rules:
 *   - `metadata.{id,name,duration}` → `{id,title,duration}` (intent/style fixed).
 *   - `positions[]` (ShowPosition) → `positions[]` (PlannedPosition):
 *       type 'pyro'      → 'pyro'
 *       type 'drone-pad' → 'drone'
 *       type 'light'     → 'anchor'
 *       heading/pitch/roll preserved (YZX convention is shared).
 *   - `pyroCues[]` (PyroCue) → `timelineItems[]` (PlannedTimelineItem) with
 *       type='pyro_effect', deterministic `M{m}:C{c}` label, `effectId`,
 *       `startTime=cue.time`, default duration 1.2s (matches simulationDryRun
 *       DEFAULT_BURN_S — single source of truth for burn proxy).
 *   - `safetyConstraints` → first three `safetyWarnings[]` entries (advisory).
 *   - Site config: deterministic from canonical hardware footprint.
 *   - `sections[]` empty (movements live in cue grouping, not blocks).
 *   - `trajectories[]` empty (drone paths not part of pyro golden seed).
 */

import type { ShowPlan as CanonicalShowPlan, ShowPosition } from '@/core/showplan/ShowPlan';
import type {
  ShowPlan as EnginePlan,
  PlannedPosition,
  PlannedTimelineItem,
  ShowSiteConfig,
} from '@/lib/aiShowBuilder/types';

const DEFAULT_BURN_S = 1.2; // mirror src/lib/showSeeds/simulationDryRun.ts

function mapPositionType(t: ShowPosition['type']): PlannedPosition['type'] {
  switch (t) {
    case 'pyro': return 'pyro';
    case 'drone-pad': return 'drone';
    case 'light': return 'anchor';
    default: return 'anchor';
  }
}

function defaultColor(t: ShowPosition['type']): string {
  switch (t) {
    case 'pyro': return '#FFB347';
    case 'drone-pad': return '#3DD2FF';
    case 'light': return '#FFFFFF';
    default: return '#888888';
  }
}

function inferSite(sp: CanonicalShowPlan): ShowSiteConfig {
  // Bound the site to the actual position footprint with a 20m audience pad.
  let minX = -45, maxX = 45, maxZ = 0, maxY = 80;
  if (sp.positions.length > 0) {
    minX = Infinity; maxX = -Infinity; maxZ = -Infinity;
    for (const p of sp.positions) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (Math.abs(p.z) > maxZ) maxZ = Math.abs(p.z);
    }
    if (!Number.isFinite(minX)) { minX = -45; maxX = 45; maxZ = 30; }
  }
  const width = Math.max(20, (maxX - minX) + 20);
  const depth = Math.max(20, maxZ * 2 + 40);
  return {
    name: sp.metadata.venue || 'Site',
    width,
    depth,
    maxHeight: maxY,
    safetyDistance: sp.safetyConstraints.nfpaMinDistance ?? 30,
    audiencePosition: 'front',
    showType: 'pyro',
  };
}

/** Pure conversion. Same input ⇒ same output (no Date.now, no Math.random). */
export function canonicalToEnginePlan(sp: CanonicalShowPlan): EnginePlan {
  const positions: PlannedPosition[] = sp.positions.map((p) => ({
    id: p.id,
    name: p.name,
    type: mapPositionType(p.type),
    x: p.x,
    y: p.y,
    z: p.z,
    heading: p.heading ?? 0,
    pitch: p.pitch ?? 0,
    roll: 0,
    color: defaultColor(p.type),
  }));

  const timelineItems: PlannedTimelineItem[] = sp.pyroCues
    .slice()
    .sort((a, b) => a.time - b.time)
    .map((cue) => ({
      id: cue.id,
      type: 'pyro_effect',
      label: `M${cue.module}:C${cue.channel}`,
      effectId: cue.effectId,
      startTime: cue.time,
      duration: DEFAULT_BURN_S,
      positionId: cue.positionId,
      positionName: undefined,
    }));

  const safetyWarnings: string[] = [];
  if (sp.safetyConstraints.requireDualKey) safetyWarnings.push('Dual-key required');
  if (sp.safetyConstraints.requireContinuityCheck) safetyWarnings.push('Continuity check required');
  safetyWarnings.push(`NFPA min distance ${sp.safetyConstraints.nfpaMinDistance}m`);

  return {
    id: sp.metadata.id,
    title: sp.metadata.name,
    duration: sp.metadata.duration,
    intent: 'Golden show reference',
    style: 'cinematic',
    site: inferSite(sp),
    sections: [],
    positions,
    timelineItems,
    trajectories: [],
    safetyWarnings,
    assumptions: [
      'simulation workMode — zero physical dispatch',
      `burn proxy ${DEFAULT_BURN_S}s per cue (matches simulationDryRun)`,
    ],
  };
}
