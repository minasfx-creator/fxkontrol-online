/**
 * Editor keyboard shortcuts — extracted from Index.tsx to reduce main chunk.
 */
import { useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import { toast } from 'sonner';

function isEditing() {
  const el = document.activeElement;
  return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || (el as HTMLElement)?.isContentEditable;
}

interface ShortcutOptions {
  selectedPositionId: string | null;
  activePanel: string | null;
  viewportMaximized: boolean;
  setShowPositionEditor: (fn: (v: boolean) => boolean) => void;
  setShowShortcuts: (fn: (v: boolean) => boolean) => void;
  setSmartScriptOpen: (fn: (v: boolean) => boolean) => void;
  setViewportMaximized: (fn: (v: boolean) => boolean) => void;
}

export function useEditorKeyboardShortcuts(opts: ShortcutOptions) {
  const {
    selectedPositionId, activePanel, viewportMaximized,
    setShowPositionEditor, setShowShortcuts, setSmartScriptOpen, setViewportMaximized,
  } = opts;

  // Viewport maximize: F / Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !activePanel) {
        e.preventDefault();
        setViewportMaximized(v => !v);
      }
      if (e.key === 'Escape' && viewportMaximized) {
        setViewportMaximized(() => false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [viewportMaximized, activePanel, setViewportMaximized]);

  // Editor shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'e' && !e.ctrlKey && !e.metaKey && !isEditing()) {
        if (selectedPositionId) setShowPositionEditor(prev => !prev);
      }
      if (e.key === '?' && e.shiftKey) setShowShortcuts(prev => !prev);

      if (!e.ctrlKey && !e.metaKey && !isEditing()) {
        if (e.key === '1') useProjectStore.getState().setSelectionMode('positions');
        if (e.key === '2') useProjectStore.getState().setSelectionMode('events');
        if (e.key === '3') useProjectStore.getState().setSelectionMode('both');
      }

      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setSmartScriptOpen(prev => !prev);
      }

      if (e.key === 'i' && !e.ctrlKey && !e.metaKey && !isEditing()) {
        const store = useProjectStore.getState();
        if (store.isPlaying || store.currentTime > 0) {
          useUndoStore.getState().checkpoint();
          store.addTimelineItem({
            id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            effectId: '', startTime: store.currentTime, trackIndex: 0,
            position: { x: 0, y: 0, z: 0 }, notes: 'Empty cue',
          });
          toast.success(`Cue inserted at ${store.currentTime.toFixed(2)}s`);
        }
      }

      if (e.key === 'a' && (e.ctrlKey || e.metaKey) && !isEditing()) {
        e.preventDefault();
        const store = useProjectStore.getState();
        if (store.editorMode === 'select') store.selectMultiplePositions(store.positions.map(p => p.id));
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isEditing()) return;
        const store = useProjectStore.getState();
        if (store.selectedPositionIds.length > 0) {
          useUndoStore.getState().checkpoint();
          store.selectedPositionIds.forEach(id => store.removePosition(id));
        }
      }

      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const store = useProjectStore.getState();
        if (store.selectedPositionIds.length > 0) {
          useUndoStore.getState().checkpoint();
          const newIds: string[] = [];
          store.selectedPositionIds.forEach(id => {
            const pos = store.positions.find(p => p.id === id);
            if (pos) {
              const newId = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
              newIds.push(newId);
              store.addPosition({ ...pos, id: newId, name: `${pos.name}-Copy`, x: pos.x + 2, z: pos.z + 2 });
            }
          });
          store.selectMultiplePositions(newIds);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedPositionId, setShowPositionEditor, setShowShortcuts, setSmartScriptOpen]);
}
