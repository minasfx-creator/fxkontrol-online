/**
 * createShowPlan — single entry point for the /create flows.
 *
 * Resets the project store atomically, persists meta to localStorage so
 * /editor/:showId can hydrate after a reload, and returns the new showId.
 *
 * Pure design-time: never touches SafetyStateMachine, ARM, or hardware.
 */
import { useProjectStore } from '@/store/useProjectStore';
import type { Position, PositionType } from '@/types/projectTypes';
import type { SegmentType } from '@/features/viewport-tools/types';
import type { CreateShowPlanInput, ShowPlanMeta } from './types';
import { saveShowMeta } from './showMetaStore';
import { getTemplate } from './templates';

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `show-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultName(input: CreateShowPlanInput): string {
  if (input.name) return input.name;
  switch (input.mode) {
    case 'template': return 'New Show (Template)';
    case 'generated': return 'New Show (AI)';
    case 'imported': return 'New Show (Imported)';
    default: return 'New Show';
  }
}

function normalizePositions(raw: unknown): Position[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p, i): Position => {
    const obj = (p ?? {}) as Partial<Position> & { type?: string };
    const type = (obj.type === 'pyro' || obj.type === 'drone-pad' || obj.type === 'light')
      ? obj.type as PositionType
      : 'pyro';
    return {
      id: typeof obj.id === 'string' ? obj.id : `pos-${Date.now()}-${i}`,
      name: typeof obj.name === 'string' ? obj.name : `P${i + 1}`,
      type,
      x: Number.isFinite(obj.x) ? Number(obj.x) : 0,
      y: Number.isFinite(obj.y) ? Number(obj.y) : 0,
      z: Number.isFinite(obj.z) ? Number(obj.z) : 0,
      heading: Number.isFinite(obj.heading) ? Number(obj.heading) : 0,
      pitch: Number.isFinite(obj.pitch) ? Number(obj.pitch) : 0,
      roll: Number.isFinite(obj.roll) ? Number(obj.roll) : 0,
      color: typeof obj.color === 'string' ? obj.color : '#00B4D8',
      section: typeof obj.section === 'string' ? obj.section : 'A',
    };
  });
}

export interface CreateShowPlanResult {
  showId: string;
  meta: ShowPlanMeta;
}

export async function createShowPlan(input: CreateShowPlanInput): Promise<CreateShowPlanResult> {
  const showId = makeId();
  let segments: SegmentType[] = input.segments && input.segments.length > 0 ? input.segments : ['PYRO'];
  let duration = input.duration ?? 120;
  let name = defaultName(input);
  let positions: Position[] = [];

  if (input.mode === 'template' && input.templateId) {
    const tpl = getTemplate(input.templateId);
    if (tpl) {
      const data = await tpl.load();
      segments = Array.isArray(data?.segments) && data.segments.length > 0 ? data.segments : tpl.segments;
      duration = typeof data?.duration === 'number' ? data.duration : tpl.duration;
      name = typeof data?.name === 'string' ? data.name : tpl.name;
      positions = normalizePositions(data?.positions);
    }
  }

  // Atomic reset — replaceProjectState wipes prior state in a single set().
  useProjectStore.getState().replaceProjectState({
    projectId: showId,
    projectName: name,
    segments,
    duration,
    positions,
    timelineItems: [],
    trajectories: [],
    cameraKeyframes: [],
    droneFormations: [],
  });

  const meta: ShowPlanMeta = {
    showId,
    name,
    mode: input.mode,
    segments,
    duration,
    createdAt: Date.now(),
    templateId: input.templateId,
    eventType: input.eventType,
    scale: input.scale,
  };
  saveShowMeta(meta);

  return { showId, meta };
}
