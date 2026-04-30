/**
 * DMX Segment Plugin (stub — MVP 1)
 *
 * DMX patch lives in dedicated stores (DMXLAYOUT visual + protocols).
 * Per the architecture rule: DMXLAYOUT.ini is visual only; ShowPlan
 * remains the source of truth. This plugin currently exposes a Conflict
 * Checker placeholder and a Universe Patch action that records intent
 * without touching protocol state.
 */

import { registerSegmentPlugin } from '../registry';
import type { ViewportSegmentPlugin, ViewportOperation } from '../types';

function uid(p: string) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const plugin: ViewportSegmentPlugin = {
  segment: 'DMX',
  validators: [],
  tools: [
    {
      id: 'dmx.conflict-check',
      label: 'Address Conflict Check',
      segment: 'DMX',
      scope: 'patch',
      command: 'DMX_CONFLICT_CHECK',
      icon: 'AlertTriangle',
      hint: 'Run cross-fixture address overlap scan (stub).',
    },
    {
      id: 'dmx.universe-patch',
      label: 'Universe Patch',
      segment: 'DMX',
      scope: 'patch',
      command: 'DMX_UNIVERSE_PATCH',
      icon: 'Layers',
      hint: 'Open DMX patch panel (stub).',
    },
  ],
  commandHandlers: {
    DMX_CONFLICT_CHECK(): ViewportOperation {
      return {
        id: uid('op'),
        segment: 'DMX',
        command: 'DMX_CONFLICT_CHECK',
        timestamp: Date.now(),
        before: null,
        after: { conflicts: 0 },
        description: 'DMX conflict check executed (stub: 0 conflicts).',
      };
    },
    DMX_UNIVERSE_PATCH(): ViewportOperation {
      return {
        id: uid('op'),
        segment: 'DMX',
        command: 'DMX_UNIVERSE_PATCH',
        timestamp: Date.now(),
        before: null,
        after: null,
        description: 'Universe patch requested (stub).',
      };
    },
  },
};

registerSegmentPlugin(plugin);

export default plugin;
