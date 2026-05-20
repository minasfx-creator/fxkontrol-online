/**
 * Load a ShowPlan (e.g. from `src/data/demoShows/*`) into the live editor store.
 * Converts pyroCues → timelineItems + ShowPosition → Position (with sensible defaults).
 */
import type { ShowPlan } from '@/core/showplan/ShowPlan';
import type { Position, TimelineItem } from '@/types/projectTypes';
import { useProjectStore } from '@/store/useProjectStore';

const POSITION_COLORS = ['#FF6B35', '#7adfff', '#7d9b76', '#c44569', '#d4a574'];

function showPositionToPosition(sp: ShowPlan['positions'][number], i: number): Position {
  return {
    id: sp.id,
    name: sp.name,
    type: sp.type === 'drone-pad' ? 'drone-pad' : sp.type === 'light' ? 'light' : 'pyro',
    x: sp.x, y: sp.y, z: sp.z,
    heading: sp.heading,
    pitch: sp.pitch,
    roll: 0,
    color: POSITION_COLORS[i % POSITION_COLORS.length],
    section: sp.section,
  };
}

function pyroCueToTimelineItem(cue: ShowPlan['pyroCues'][number]): TimelineItem {
  return {
    id: cue.id,
    effectId: cue.effectId,
    startTime: cue.time,
    trackIndex: 0,
    position: cue.position,
    positionId: cue.positionId,
    positionName: cue.positionId,
    cueHeading: cue.heading,
    cuePitch: cue.elevation,
    notes: cue.notes,
    rack: cue.rack,
    tube: cue.tube,
    section: cue.section,
    universe: cue.module != null ? String(cue.module) : undefined,
  };
}

export function loadShowPlanIntoStore(plan: ShowPlan): void {
  const positions = plan.positions.map(showPositionToPosition);
  const timelineItems = plan.pyroCues.map(pyroCueToTimelineItem);
  const store = useProjectStore.getState();
  // Direct set — store actions don't expose a single batch loader.
  // The fields below match the ProjectState shape.
  (useProjectStore.setState as (s: Record<string, unknown>) => void)({
    positions,
    timelineItems,
    duration: plan.metadata.duration,
    projectName: plan.metadata.name,
    selectedPositionId: null,
    selectedTimelineItemId: null,
    selectedTimelineItemIds: [],
  });
  store.setDuration?.(plan.metadata.duration);
  store.setProjectName?.(plan.metadata.name);
}
