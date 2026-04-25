/**
 * Studio AI Compose — client helper.
 *
 * Calls the studio-ai-compose edge function and applies the returned
 * plan directly to useProjectStore. Single transaction → single undo.
 *
 * No diff / preview: the prompt IS the apply action. If the designer
 * wants tweaks, they edit manually in the timeline afterwards.
 */
import { supabase } from '@/integrations/supabase/client';
import { useProjectStore } from '@/store/useProjectStore';
import type { Position, TimelineItem } from '@/types/projectTypes';

export interface ComposedPlan {
  title: string;
  duration: number;
  assumptions?: string[];
  positions: Array<{
    id: string;
    name: string;
    type: 'pyro' | 'drone-pad' | 'light';
    x: number;
    z: number;
  }>;
  timeline: Array<{
    effectId: string;
    positionId: string;
    startTime: number;
    trackIndex?: number;
    notes?: string;
  }>;
}

export interface ComposeResult {
  plan: ComposedPlan;
  meta: {
    model: string;
    positionCount: number;
    timelineCount: number;
    orphanCount: number;
  };
}

const COLOR_BY_TYPE: Record<ComposedPlan['positions'][number]['type'], string> = {
  pyro: '#FF6B35',
  'drone-pad': '#00B4D8',
  light: '#FFD60A',
};

export async function composePromptToPlan(prompt: string): Promise<ComposeResult> {
  const { data, error } = await supabase.functions.invoke('studio-ai-compose', {
    body: { prompt },
  });
  if (error) {
    // Surface payment / rate-limit messages from the function body when present
    const msg = (data as any)?.error || error.message || 'Falha ao compor com a AI';
    throw new Error(msg);
  }
  if (!data || !(data as any).plan) {
    throw new Error('Resposta inválida da AI (sem plano)');
  }
  return data as ComposeResult;
}

/**
 * Apply a ComposedPlan to the project store, replacing positions and timeline
 * with the new content. Atomic write = one undo step.
 *
 * Returns counts for the toast.
 */
export function applyPlanToStore(plan: ComposedPlan): {
  positions: number;
  timelineItems: number;
  duration: number;
} {
  const store = useProjectStore.getState();

  // Stamp ids so future drags/edits don't collide with AI ids
  const stamp = Date.now().toString(36);
  const idMap = new Map<string, string>();

  const positions: Position[] = plan.positions.map((p, i) => {
    const newId = `ai-pos-${stamp}-${i}`;
    idMap.set(p.id, newId);
    return {
      id: newId,
      name: p.name || `Pos ${i + 1}`,
      type: p.type,
      x: Number.isFinite(p.x) ? p.x : 0,
      y: 0,
      z: Number.isFinite(p.z) ? p.z : 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      color: COLOR_BY_TYPE[p.type] ?? '#00B4D8',
    };
  });

  const validIds = new Set(idMap.values());
  const timelineItems: TimelineItem[] = plan.timeline
    .map((t, i) => {
      const positionId = idMap.get(t.positionId);
      if (!positionId) return null;
      const pos = positions.find((p) => p.id === positionId);
      return {
        id: `ai-tl-${stamp}-${i}`,
        effectId: String(t.effectId || 'mort-01'),
        startTime: Math.max(0, Number.isFinite(t.startTime) ? t.startTime : 0),
        trackIndex: Math.max(0, Math.min(16, Number.isFinite(t.trackIndex as number) ? (t.trackIndex as number) : 0)),
        position: { x: pos?.x ?? 0, y: 0, z: pos?.z ?? 0 },
        positionId,
        positionName: pos?.name,
        notes: t.notes,
      } as TimelineItem;
    })
    .filter((x): x is TimelineItem => x !== null && validIds.has(x.positionId!));

  const lastEnd = timelineItems.reduce((m, t) => Math.max(m, t.startTime + 5), 0);
  const duration = Math.max(plan.duration ?? 0, lastEnd, 30);

  // Atomic state write — replaces existing show content
  useProjectStore.setState({
    projectName: plan.title || store.projectName,
    positions,
    timelineItems,
    duration,
    selectedTimelineItemId: null,
    selectedTimelineItemIds: [],
    selectedPositionId: null,
    selectedPositionIds: [],
  });

  // Reset clock to 0 if available
  try {
    store.setCurrentTime?.(0);
  } catch { /* noop */ }

  return {
    positions: positions.length,
    timelineItems: timelineItems.length,
    duration,
  };
}
