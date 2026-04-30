/**
 * DRONES Segment Plugin (MVP 1)
 *
 * Tools:
 *   DRONES_SELECT_ALL     — pick every drone-pad position
 *   DRONES_FORMATION_CIRCLE — arrange selected pads on a circle (Y kept)
 *
 * The collision/RTH/altitude validators run continuously via the panel.
 */

import { registerSegmentPlugin } from '../registry';
import type { ViewportSegmentPlugin, ViewportOperation } from '../types';
import { selectAllBySegment } from '../selection-engine';
import { dronesValidators } from '../validators/drones.validator';
import { useProjectStore } from '@/store/useProjectStore';
import { useSafetyOverlayStore } from '../safetyOverlayStore';
import type { Position } from '@/types/projectTypes';

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const plugin: ViewportSegmentPlugin = {
  segment: 'DRONES',
  validators: dronesValidators,
  tools: [
    {
      id: 'drones.select-all',
      label: 'Select All Drones',
      segment: 'DRONES',
      scope: 'selection',
      command: 'DRONES_SELECT_ALL',
      icon: 'MousePointerClick',
      hint: 'Select every drone pad in the show.',
    },
    {
      id: 'drones.formation-circle',
      label: 'Formation: Circle',
      segment: 'DRONES',
      scope: 'generate',
      command: 'DRONES_FORMATION_CIRCLE',
      icon: 'CircleDot',
      requiresSelection: true,
      hint: 'Arrange selected pads on an evenly-spaced circle.',
    },
    {
      id: 'drones.configure',
      label: 'Configure Drone',
      segment: 'DRONES',
      scope: 'edit',
      command: 'DRONES_CONFIGURE',
      icon: 'SlidersHorizontal',
      requiresSelection: true,
      hint: 'Edit position + formation parameters for the selected drone pad.',
    },
    {
      id: 'drones.toggle-collision',
      label: 'Toggle Collision Preview',
      segment: 'DRONES',
      scope: 'safety',
      command: 'DRONES_TOGGLE_COLLISION',
      icon: 'ShieldAlert',
      hint: 'Show / hide real-time collision-avoidance lines between drones.',
    },
    {
      id: 'drones.run-validators',
      label: 'Run Advanced Validators',
      segment: 'DRONES',
      scope: 'safety',
      command: 'DRONES_RUN_VALIDATORS',
      icon: 'ShieldCheck',
      hint: 'Run all validators (PYRO + FireOne + Showven + DRONES proximity).',
    },
    {
      id: 'drones.export-mavlink',
      label: 'Export MAVLink Plan',
      segment: 'DRONES',
      scope: 'patch',
      command: 'EXPORT_OPEN_CENTER',
      icon: 'Download',
      hint: 'Open Export Center to download QGC WPL 110 / JSON for the swarm.',
    },
  ],
  commandHandlers: {
    DRONES_SELECT_ALL(): ViewportOperation | null {
      const before = useProjectStore.getState().selectedPositionIds.slice();
      const count = selectAllBySegment('DRONES');
      const after = useProjectStore.getState().selectedPositionIds.slice();
      return {
        id: uid('op'),
        segment: 'DRONES',
        command: 'DRONES_SELECT_ALL',
        timestamp: Date.now(),
        before: { selection: before },
        after: { selection: after },
        description: `Selected ${count} drone pad(s).`,
      };
    },

    DRONES_FORMATION_CIRCLE(payload, ctx): ViewportOperation | null {
      const radius = (payload as { radius?: number })?.radius ?? 5;
      const state = useProjectStore.getState();
      const sel = ctx.selectionIds
        .map((id) => state.positions.find((p) => p.id === id))
        .filter((p): p is Position => !!p && p.type === 'drone-pad');
      if (sel.length === 0) return null;

      // Centroid of current selection (preserve location).
      const cx = sel.reduce((s, p) => s + p.x, 0) / sel.length;
      const cz = sel.reduce((s, p) => s + p.z, 0) / sel.length;

      const beforePositions: Position[] = sel.map((p) => ({ ...p }));
      const ids = new Set(sel.map((p) => p.id));
      const afterPositions = state.positions.map((p) => {
        if (!ids.has(p.id)) return p;
        const idx = sel.findIndex((s) => s.id === p.id);
        const angle = (idx / sel.length) * Math.PI * 2;
        return {
          ...p,
          x: cx + Math.cos(angle) * radius,
          z: cz + Math.sin(angle) * radius,
        };
      });
      useProjectStore.setState({ positions: afterPositions });

      return {
        id: uid('op'),
        segment: 'DRONES',
        command: 'DRONES_FORMATION_CIRCLE',
        timestamp: Date.now(),
        before: { positions: beforePositions },
        after: { radius, count: sel.length },
        description: `Arranged ${sel.length} pad(s) on a ${radius}m circle.`,
      };
    },

    DRONES_CONFIGURE(_payload, ctx): ViewportOperation | null {
      const state = useProjectStore.getState();
      const padId = ctx.selectionIds.find((id) => {
        const p = state.positions.find((q) => q.id === id);
        return p?.type === 'drone-pad';
      });
      if (!padId) return null;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('viewport-tools:open-drone-config', {
            detail: { positionId: padId },
          })
        );
      }
      return null;
    },

    DRONES_TOGGLE_COLLISION(): ViewportOperation | null {
      const before = useSafetyOverlayStore.getState().dronesCollisionVisible;
      useSafetyOverlayStore.getState().toggleDronesCollision();
      const after = useSafetyOverlayStore.getState().dronesCollisionVisible;
      return {
        id: uid('op'),
        segment: 'DRONES',
        command: 'DRONES_TOGGLE_COLLISION',
        timestamp: Date.now(),
        before: { visible: before },
        after: { visible: after },
        description: `Collision overlay ${after ? 'shown' : 'hidden'}.`,
      };
    },

    DRONES_RUN_VALIDATORS(): ViewportOperation | null {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('viewport-tools:open-validators-report'));
      }
      return {
        id: uid('op'),
        segment: 'DRONES',
        command: 'DRONES_RUN_VALIDATORS',
        timestamp: Date.now(),
        before: null,
        after: null,
        description: 'Opened advanced validators report.',
      };
    },

    EXPORT_OPEN_CENTER(): ViewportOperation | null {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('viewport-tools:open-export-center'));
      }
      return {
        id: uid('op'),
        segment: 'DRONES',
        command: 'EXPORT_OPEN_CENTER',
        timestamp: Date.now(),
        before: null,
        after: null,
        description: 'Opened export center.',
      };
    },
  },
};

registerSegmentPlugin(plugin);

export default plugin;
