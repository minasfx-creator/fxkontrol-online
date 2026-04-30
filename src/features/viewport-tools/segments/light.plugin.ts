/**
 * LIGHT Segment Plugin (MVP 1)
 *
 * Real selectAll on Position.type === 'light'. Other tools are stubs that
 * record an operation describing the selection so workflows can be wired
 * later. Honest: no fake DMX writes.
 */

import { registerSegmentPlugin } from '../registry';
import type { ViewportSegmentPlugin, ViewportOperation } from '../types';
import { selectAllBySegment } from '../selection-engine';
import { useProjectStore } from '@/store/useProjectStore';

function uid(p: string) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const plugin: ViewportSegmentPlugin = {
  segment: 'LIGHT',
  validators: [],
  tools: [
    {
      id: 'light.select-all',
      label: 'Select All Fixtures',
      segment: 'LIGHT',
      scope: 'selection',
      command: 'LIGHT_SELECT_ALL',
      icon: 'MousePointerClick',
    },
    {
      id: 'light.dimmer-100',
      label: 'Dimmer 100%',
      segment: 'LIGHT',
      scope: 'edit',
      command: 'LIGHT_DIMMER_100',
      icon: 'SunMedium',
      requiresSelection: true,
      hint: 'Stub — wire to fixture profile when LIGHT model lands.',
    },
  ],
  commandHandlers: {
    LIGHT_SELECT_ALL(): ViewportOperation {
      const before = useProjectStore.getState().selectedPositionIds.slice();
      const count = selectAllBySegment('LIGHT');
      const after = useProjectStore.getState().selectedPositionIds.slice();
      return {
        id: uid('op'),
        segment: 'LIGHT',
        command: 'LIGHT_SELECT_ALL',
        timestamp: Date.now(),
        before: { selection: before },
        after: { selection: after },
        description: `Selected ${count} fixture(s).`,
      };
    },
    LIGHT_DIMMER_100(_p, ctx): ViewportOperation {
      return {
        id: uid('op'),
        segment: 'LIGHT',
        command: 'LIGHT_DIMMER_100',
        timestamp: Date.now(),
        before: null,
        after: { ids: ctx.selectionIds },
        description: `Dimmer 100% queued for ${ctx.selectionIds.length} fixture(s) (stub).`,
      };
    },
  },
};

registerSegmentPlugin(plugin);

export default plugin;
