/**
 * cueMarkersToEnginePlan — Pure adapter that turns the canonical
 * `useProjectStore.cueMarkers` array into an engine `ShowPlan` so
 * `Show3DEngine` can fire Particle Explosions (pyro/formation) and
 * Light Points (drone) when the audio master clock crosses each cue.
 *
 * Plano: Show / Experience. ZERO CommandBus / FieldBus / SafetyStateMachine.
 * Deterministic. Same input ⇒ same output.
 */

import type {
  ShowPlan as EnginePlan,
  PlannedTimelineItem,
  PlannedPosition,
  ShowSiteConfig,
} from '@/lib/aiShowBuilder/types';
import type { CueMarker } from '@/types/projectTypes';

const SITE: ShowSiteConfig = {
  name: 'SkyCanvas Live Preview',
  width: 240,
  depth: 120,
  maxHeight: 120,
  safetyDistance: 20,
  audiencePosition: 'front',
  showType: 'hybrid',
};

const ANCHOR_PYRO: PlannedPosition = {
  id: 'sk-anchor-pyro',
  name: 'Pyro stage center',
  type: 'pyro',
  x: 0, y: 0, z: 0,
  heading: 0, pitch: 0, roll: 0,
  color: '#FFB347',
};

const ANCHOR_DRONE: PlannedPosition = {
  id: 'sk-anchor-drone',
  name: 'Drone hover anchor',
  type: 'drone',
  x: 0, y: 30, z: 0,
  heading: 0, pitch: 0, roll: 0,
  color: '#3DD2FF',
};

function classifyLane(cue: CueMarker): 'pyro' | 'drone' | 'formation' {
  if (cue.lane) return cue.lane;
  const lbl = (cue.label ?? '').toLowerCase();
  if (lbl.includes('formation')) return 'formation';
  if (lbl.includes('drone')) return 'drone';
  return 'pyro';
}

function laneToItem(cue: CueMarker): PlannedTimelineItem {
  const lane = classifyLane(cue);
  const dur = Math.max(0.2, cue.durationSec ?? (lane === 'pyro' ? 1.2 : 0.8));
  if (lane === 'drone' || lane === 'formation') {
    return {
      id: cue.id,
      type: 'drone_move',
      label: cue.label,
      effectId: cue.effectId,
      startTime: Math.max(0, cue.time),
      duration: dur,
      positionId: ANCHOR_DRONE.id,
    };
  }
  return {
    id: cue.id,
    type: 'pyro_effect',
    label: cue.label,
    effectId: cue.effectId,
    startTime: Math.max(0, cue.time),
    duration: dur,
    positionId: ANCHOR_PYRO.id,
    intensity: 'medium',
  };
}

export interface CueMarkersToEnginePlanOpts {
  /** Plan id (engine memoization key). */
  id?: string;
  /** Total show duration for the engine clock. */
  duration: number;
}

export function cueMarkersToEnginePlan(
  cues: readonly CueMarker[],
  opts: CueMarkersToEnginePlanOpts,
): EnginePlan {
  const items = cues
    .slice()
    .sort((a, b) => a.time - b.time)
    .map(laneToItem);

  return {
    id: opts.id ?? 'skycanvas-live',
    title: 'SkyCanvas Live Cues',
    duration: Math.max(opts.duration, 1),
    intent: 'live preview overlay',
    style: 'cinematic',
    site: SITE,
    sections: [],
    positions: [ANCHOR_PYRO, ANCHOR_DRONE],
    timelineItems: items,
    trajectories: [],
    safetyWarnings: [],
    assumptions: ['simulation workMode — visual only'],
  };
}
