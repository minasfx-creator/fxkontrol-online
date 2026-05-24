/**
 * SFX Segment Plugin (stub — MVP 1)
 *
 * No Position.type for SFX yet. selectAllBySegment('SFX') honestly returns
 * 0. Tools are scaffolded so the UI shows the segment and the operation
 * log records intent — wiring lands when the SFX model is added.
 */

import { registerSegmentPlugin } from '../registry';
import type { ViewportSegmentPlugin, ViewportOperation } from '../types';

function uid(p: string) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const plugin: ViewportSegmentPlugin = {
  segment: 'SFX',
  validators: [],
  tools: [
    {
      id: 'sfx.select-all',
      label: 'Select All SFX',
      segment: 'SFX',
      scope: 'selection',
      command: 'SFX_SELECT_ALL',
      icon: 'MousePointerClick',
      hint: 'No SFX positions yet — wired when SFX type lands.',
    },
    {
      id: 'sfx.co2-jet',
      label: 'CO₂ Jet',
      segment: 'SFX',
      scope: 'generate',
      command: 'SFX_CO2',
      icon: 'Cloud',
      requiresSelection: true,
    },
  ],
  commandHandlers: {
    SFX_SELECT_ALL(): ViewportOperation {
      return {
        id: uid('op'),
        segment: 'SFX',
        command: 'SFX_SELECT_ALL',
        timestamp: Date.now(),
        before: null,
        after: { selection: [] },
        description: 'No SFX positions defined.',
      };
    },
    SFX_CO2(_p, ctx): ViewportOperation {
      return {
        id: uid('op'),
        segment: 'SFX',
        command: 'SFX_CO2',
        timestamp: Date.now(),
        before: null,
        after: { ids: ctx.selectionIds },
        description: `CO₂ jet queued (stub) for ${ctx.selectionIds.length} target(s).`,
      };
    },
  },
};

registerSegmentPlugin(plugin);

export default plugin;
