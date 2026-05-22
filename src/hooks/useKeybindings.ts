/**
 * useKeybindings — Professional keyboard shortcuts (Finale 3D standard)
 * Space: Play/Pause | Shift+R: Toggle Transform Mode | Delete: Remove selected
 * Ctrl+C/V: Copy/Paste cues | W/E/R: Transform modes | ?: Cheat Sheet
 */
import { useEffect, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { toast } from 'sonner';

// Clipboard for copy/paste
let _clipboard: {
  effectId: string;
  position: { x: number; y: number; z: number };
  cueHeading?: number;
  cuePitch?: number;
  notes?: string;
}[] = [];

export function useKeybindings() {
  const handler = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    // Skip if typing in an input/textarea/select
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
      return;
    }

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // ═══ Space: Play/Pause ═══
    if (e.code === 'Space' && !ctrl && !shift) {
      e.preventDefault();
      const { isPlaying, setPlaying } = useProjectStore.getState();
      setPlaying(!isPlaying);
      return;
    }

    // ═══ W/E/R: Transform gizmo modes ═══
    if (!ctrl && !shift) {
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        useSceneStore.getState().updateEnvironment({ positionTransformMode: 'translate' });
        toast.info('Gizmo: Move (W)');
        return;
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        useSceneStore.getState().updateEnvironment({ positionTransformMode: 'rotate' });
        toast.info('Gizmo: Rotate (E)');
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        useSceneStore.getState().updateEnvironment({ positionTransformMode: 'scale' });
        toast.info('Gizmo: Scale (R)');
        return;
      }
    }

    // ═══ Shift+R: Toggle Transform Mode ═══
    if (shift && (e.key === 'R' || e.key === 'r') && !ctrl) {
      e.preventDefault();
      const env = useSceneStore.getState().environment;
      const modes = ['translate', 'rotate', 'scale'] as const;
      const idx = modes.indexOf(env.positionTransformMode);
      const next = modes[(idx + 1) % modes.length];
      useSceneStore.getState().updateEnvironment({ positionTransformMode: next });
      toast.info(`Transform: ${next}`);
      return;
    }

    // ═══ Delete / Backspace: Remove selected ═══
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const state = useProjectStore.getState();

      // Remove selected timeline items
      if (state.selectedTimelineItemIds.length > 0) {
        state.removeMultipleTimelineItems(state.selectedTimelineItemIds);
        toast.info(`${state.selectedTimelineItemIds.length} cue(s) removidas`);
        return;
      }
      if (state.selectedTimelineItemId) {
        state.removeTimelineItem(state.selectedTimelineItemId);
        toast.info('Cue removida');
        return;
      }

      // Remove selected positions
      if (state.selectedPositionIds.length > 0) {
        state.selectedPositionIds.forEach(id => state.removePosition(id));
        toast.info(`${state.selectedPositionIds.length} posição(ões) removidas`);
        return;
      }
      if (state.selectedPositionId) {
        state.removePosition(state.selectedPositionId);
        toast.info('Posição removida');
        return;
      }
      return;
    }

    // ═══ Ctrl+C: Copy selected cues ═══
    if (ctrl && e.key === 'c') {
      const state = useProjectStore.getState();
      const ids = state.selectedTimelineItemIds.length > 0
        ? state.selectedTimelineItemIds
        : state.selectedTimelineItemId ? [state.selectedTimelineItemId] : [];

      if (ids.length === 0) return;

      _clipboard = ids.map(id => {
        const item = state.timelineItems.find(i => i.id === id);
        if (!item) return null;
        return {
          effectId: item.effectId,
          position: { ...item.position },
          cueHeading: item.cueHeading,
          cuePitch: item.cuePitch,
          notes: item.notes,
        };
      }).filter(Boolean) as typeof _clipboard;

      toast.info(`${_clipboard.length} cue(s) copiadas`);
      return;
    }

    // ═══ Ctrl+V: Paste cues at current time ═══
    if (ctrl && e.key === 'v') {
      if (_clipboard.length === 0) return;
      e.preventDefault();
      const state = useProjectStore.getState();
      const baseTime = state.currentTime;

      _clipboard.forEach((item, i) => {
        state.addTimelineItem({
          id: `tl-paste-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
          effectId: item.effectId,
          startTime: baseTime + i * 0.1,
          trackIndex: 0,
          position: { ...item.position },
          cueHeading: item.cueHeading,
          cuePitch: item.cuePitch,
          notes: item.notes,
        });
      });

      toast.success(`${_clipboard.length} cue(s) coladas em t=${baseTime.toFixed(2)}s`);
      return;
    }

    // ═══ ? key: Open cheat sheet ═══
    if (e.key === '?' || (shift && e.key === '/')) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('toggle-keybinding-cheatsheet'));
      return;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}

/** All keybindings for the cheat sheet */
export const KEYBINDING_LIST = [
  { key: 'Space', action: 'Play / Pause', category: 'Playback' },
  { key: 'F', action: 'Maximizar viewport', category: 'Viewport' },
  { key: 'W', action: 'Gizmo: Move', category: 'Transform' },
  { key: 'E', action: 'Gizmo: Rotate', category: 'Transform' },
  { key: 'R', action: 'Gizmo: Scale', category: 'Transform' },
  { key: 'Shift+R', action: 'Ciclar modo Transform', category: 'Transform' },
  { key: 'Delete', action: 'Remover seleção', category: 'Editing' },
  { key: 'Ctrl+C', action: 'Copiar cues', category: 'Editing' },
  { key: 'Ctrl+V', action: 'Colar cues no playhead', category: 'Editing' },
  { key: 'Ctrl+Z', action: 'Desfazer', category: 'Editing' },
  { key: 'Ctrl+Shift+Z', action: 'Refazer', category: 'Editing' },
  { key: '?', action: 'Mostrar atalhos', category: 'System' },
  { key: 'Dbl-Click', action: 'Foco na posição 3D', category: 'Viewport' },
  { key: 'Alt+Drag', action: 'Box Select', category: 'Viewport' },
  { key: 'Shift+Click', action: 'Multi-Select', category: 'Viewport' },
  { key: 'Scroll', action: 'Zoom', category: 'Viewport' },
  { key: 'MMB Drag', action: 'Pan (Translação)', category: 'Viewport' },
  { key: 'LMB Drag', action: 'Orbit (Rotação)', category: 'Viewport' },
];
