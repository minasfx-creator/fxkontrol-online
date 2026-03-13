import { useEffect } from 'react';
import { useUndoStore } from '@/store/useUndoStore';
import { toast } from 'sonner';

/** Global keyboard listener for Ctrl+Z / Ctrl+Shift+Z */
export function useUndoKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const { canUndo, undo } = useUndoStore.getState();
        if (canUndo) { undo(); toast.info('Undo'); }
      }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        const { canRedo, redo } = useUndoStore.getState();
        if (canRedo) { redo(); toast.info('Redo'); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
