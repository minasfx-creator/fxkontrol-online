/**
 * PYRO Segment Plugin
 * ────────────────────────────────────────────────────────────
 * Tools registered (MVP 1):
 *   PYRO_SELECT_ALL    — selection : pick every pyro position
 *   PYRO_GROUP_BY_POS  — edit      : log groups (read-only inspection)
 *   PYRO_TIME_OFFSET   — edit      : shift selected cues by Δms
 *   PYRO_MIRROR_CLONE  — edit      : duplicate selected cues with offset
 *
 * The plugin NEVER mutates the viewport; it only updates the project store
 * (canonical ShowPlan source). Each handler returns a ViewportOperation so
 * the dispatcher can record undo state.
 */

import { registerSegmentPlugin } from '../registry';
import type { ViewportSegmentPlugin, ViewportOperation } from '../types';
import { selectAllBySegment } from '../selection-engine';
import { pyroValidators } from '../validators/pyro.validator';
import { useProjectStore } from '@/store/useProjectStore';
import type { TimelineItem } from '@/types/projectTypes';

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const plugin: ViewportSegmentPlugin = {
  segment: 'PYRO',
  validators: pyroValidators,
  tools: [
    {
      id: 'pyro.select-all',
      label: 'Select All Pyro',
      segment: 'PYRO',
      scope: 'selection',
      command: 'PYRO_SELECT_ALL',
      icon: 'MousePointerClick',
      hint: 'Select every pyro position in the show.',
    },
    {
      id: 'pyro.group-by-position',
      label: 'Group by Position',
      segment: 'PYRO',
      scope: 'edit',
      command: 'PYRO_GROUP_BY_POS',
      icon: 'Group',
      requiresSelection: true,
      hint: 'Inspect cue clusters per selected position.',
    },
    {
      id: 'pyro.time-offset',
      label: 'Time Offset (+50 ms)',
      segment: 'PYRO',
      scope: 'edit',
      command: 'PYRO_TIME_OFFSET',
      icon: 'Clock',
      requiresSelection: true,
      hint: 'Shift cues on selected positions by +50 ms (Shift = -50 ms).',
    },
    {
      id: 'pyro.mirror-clone',
      label: 'Mirror / Clone (+1 s)',
      segment: 'PYRO',
      scope: 'edit',
      command: 'PYRO_MIRROR_CLONE',
      icon: 'Copy',
      requiresSelection: true,
      safetyCritical: true,
      hint: 'Duplicate cues on selected positions, +1 s later.',
    },
    {
      id: 'pyro.configure-effect',
      label: 'Configure Effect',
      segment: 'PYRO',
      scope: 'edit',
      command: 'PYRO_CONFIGURE_EFFECT',
      icon: 'SlidersHorizontal',
      hint: 'Open the parameter editor for the selected cue / effect.',
    },
  ],
  commandHandlers: {
    PYRO_SELECT_ALL(): ViewportOperation | null {
      const before = useProjectStore.getState().selectedPositionIds.slice();
      const count = selectAllBySegment('PYRO');
      const after = useProjectStore.getState().selectedPositionIds.slice();
      return {
        id: uid('op'),
        segment: 'PYRO',
        command: 'PYRO_SELECT_ALL',
        timestamp: Date.now(),
        before: { selection: before },
        after: { selection: after },
        description: `Selected ${count} pyro position(s).`,
      };
    },

    PYRO_GROUP_BY_POS(_payload, ctx): ViewportOperation | null {
      const items = useProjectStore.getState().timelineItems;
      const counts: Record<string, number> = {};
      for (const id of ctx.selectionIds) counts[id] = 0;
      for (const it of items) {
        if (it.positionId && counts[it.positionId] !== undefined) {
          counts[it.positionId]++;
        }
      }
      return {
        id: uid('op'),
        segment: 'PYRO',
        command: 'PYRO_GROUP_BY_POS',
        timestamp: Date.now(),
        before: null,
        after: { counts },
        description: `Grouped ${ctx.selectionIds.length} position(s).`,
      };
    },

    PYRO_TIME_OFFSET(payload, ctx): ViewportOperation | null {
      const deltaSec = ((payload as { deltaMs?: number })?.deltaMs ?? 50) / 1000;
      const sel = new Set(ctx.selectionIds);
      const state = useProjectStore.getState();
      const beforeItems: TimelineItem[] = [];
      const afterItems = state.timelineItems.map((it) => {
        if (it.positionId && sel.has(it.positionId)) {
          beforeItems.push({ ...it });
          return { ...it, startTime: Math.max(0, it.startTime + deltaSec) };
        }
        return it;
      });
      if (beforeItems.length === 0) return null;
      useProjectStore.setState({ timelineItems: afterItems });
      return {
        id: uid('op'),
        segment: 'PYRO',
        command: 'PYRO_TIME_OFFSET',
        timestamp: Date.now(),
        before: { items: beforeItems },
        after: { deltaSec, ids: beforeItems.map((b) => b.id) },
        description: `Shifted ${beforeItems.length} cue(s) by ${(deltaSec * 1000).toFixed(0)} ms.`,
      };
    },

    PYRO_MIRROR_CLONE(payload, ctx): ViewportOperation | null {
      const offsetSec = (payload as { offsetSec?: number })?.offsetSec ?? 1;
      const sel = new Set(ctx.selectionIds);
      const state = useProjectStore.getState();
      const clones: TimelineItem[] = [];
      for (const it of state.timelineItems) {
        if (it.positionId && sel.has(it.positionId)) {
          clones.push({
            ...it,
            id: uid('cue'),
            startTime: it.startTime + offsetSec,
          });
        }
      }
      if (clones.length === 0) return null;
      useProjectStore.setState({
        timelineItems: [...state.timelineItems, ...clones],
      });
      return {
        id: uid('op'),
        segment: 'PYRO',
        command: 'PYRO_MIRROR_CLONE',
        timestamp: Date.now(),
        before: null,
        after: { clonedIds: clones.map((c) => c.id) },
        description: `Cloned ${clones.length} cue(s) +${offsetSec}s.`,
      };
    },

    PYRO_CONFIGURE_EFFECT(_payload, ctx): ViewportOperation | null {
      const state = useProjectStore.getState();
      // Prefer the explicitly selected timeline item; otherwise pick the
      // first cue belonging to the selected pyro position.
      let timelineItemId: string | null = state.selectedTimelineItemId ?? null;
      let effectId: string | null = null;

      if (timelineItemId) {
        const it = state.timelineItems.find((t) => t.id === timelineItemId);
        effectId = it?.effectId ?? null;
      }
      if (!effectId && ctx.selectionIds.length > 0) {
        const sel = new Set(ctx.selectionIds);
        const first = state.timelineItems.find(
          (t) => t.positionId && sel.has(t.positionId)
        );
        if (first) {
          timelineItemId = first.id;
          effectId = first.effectId;
        }
      }

      if (!effectId) return null;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('viewport-tools:open-effect-config', {
            detail: { effectId, timelineItemId },
          })
        );
      }
      return null; // dialog handles its own ops
    },
  },
};

registerSegmentPlugin(plugin);

export default plugin;
