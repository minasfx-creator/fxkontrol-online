/**
 * DMX Segment Plugin (MVP 2)
 *
 * Tools:
 *   DMX_CONFLICT_CHECK   — runs auditDmxPatch() and opens the patch dialog
 *                          on the Conflicts tab. Records a viewport operation
 *                          with the totals snapshot for audit.
 *   DMX_UNIVERSE_PATCH   — opens the patch dialog on the Patch tab.
 *
 * Architecture rule: DMXLAYOUT.ini is visual only. ShowPlan stays the source
 * of truth. The dialog is read-only over dmxCues; it never mutates them.
 */

import { registerSegmentPlugin } from '../registry';
import type { ViewportSegmentPlugin, ViewportOperation } from '../types';
import { auditDmxPatch } from '../dmx/dmxConflictChecker';
import { useSafetyOverlayStore } from '../safetyOverlayStore';

function uid(p: string) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function openPatchDialog(initialTab: 'patch' | 'conflicts') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('viewport-tools:open-dmx-patch', { detail: { tab: initialTab } }),
  );
}

const plugin: ViewportSegmentPlugin = {
  segment: 'DMX',
  validators: [],
  tools: [
    {
      id: 'dmx.universe-patch',
      label: 'Universe Patch',
      segment: 'DMX',
      scope: 'patch',
      command: 'DMX_UNIVERSE_PATCH',
      icon: 'Layers',
      hint: 'Open the visual DMX patch panel (universes, fixtures, channels).',
    },
    {
      id: 'dmx.conflict-check',
      label: 'Conflict Checker',
      segment: 'DMX',
      scope: 'patch',
      command: 'DMX_CONFLICT_CHECK',
      icon: 'AlertTriangle',
      hint: 'Scan address overlaps, range errors and unpatched cues.',
    },
    {
      id: 'dmx.toggle-heatmap',
      label: 'Toggle Heatmap',
      segment: 'DMX',
      scope: 'preview',
      command: 'DMX_TOGGLE_HEATMAP',
      icon: 'Activity',
      hint: 'Show/hide live per-universe channel intensity overlay.',
    },
  ],
  commandHandlers: {
    DMX_UNIVERSE_PATCH(): ViewportOperation {
      openPatchDialog('patch');
      return {
        id: uid('op'),
        segment: 'DMX',
        command: 'DMX_UNIVERSE_PATCH',
        timestamp: Date.now(),
        before: null,
        after: null,
        description: 'DMX patch panel opened.',
      };
    },
    DMX_CONFLICT_CHECK(): ViewportOperation {
      const report = auditDmxPatch();
      openPatchDialog('conflicts');
      return {
        id: uid('op'),
        segment: 'DMX',
        command: 'DMX_CONFLICT_CHECK',
        timestamp: Date.now(),
        before: null,
        after: {
          totals: report.totals,
        },
        description: `DMX conflict scan: ${report.totals.errors} error(s), ${report.totals.warnings} warning(s).`,
      };
    },
    DMX_TOGGLE_HEATMAP(): ViewportOperation {
      const before = useSafetyOverlayStore.getState().dmxHeatmapVisible;
      useSafetyOverlayStore.getState().toggleDmxHeatmap();
      const after = useSafetyOverlayStore.getState().dmxHeatmapVisible;
      return {
        id: uid('op'),
        segment: 'DMX',
        command: 'DMX_TOGGLE_HEATMAP',
        timestamp: Date.now(),
        before: { visible: before },
        after: { visible: after },
        description: `DMX heatmap ${after ? 'shown' : 'hidden'}.`,
      };
    },
  },
};

registerSegmentPlugin(plugin);

export default plugin;
