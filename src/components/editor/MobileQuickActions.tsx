/**
 * MobileQuickActions — Apple-style floating action buttons
 * Contextual, minimal, with smooth spring animations.
 */
import { useCallback } from 'react';
import { MousePointer2, Plus, Undo2, Redo2, Trash2, Copy, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';

export default function MobileQuickActions() {
  const selectedIds = useProjectStore(s => s.selectedPositionIds);
  const editorMode = useProjectStore(s => s.editorMode);
  const setEditorMode = useProjectStore(s => s.setEditorMode);
  const hasSelection = selectedIds.length > 0;

  const handleUndo = useCallback(() => { useUndoStore.getState().undo(); }, []);
  const handleRedo = useCallback(() => { useUndoStore.getState().redo(); }, []);

  const handleDelete = useCallback(() => {
    const store = useProjectStore.getState();
    useUndoStore.getState().checkpoint();
    store.selectedPositionIds.forEach(id => store.removePosition(id));
  }, []);

  const handleDuplicate = useCallback(() => {
    const store = useProjectStore.getState();
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
  }, []);

  const handleAdd = useCallback(() => {
    const store = useProjectStore.getState();
    useUndoStore.getState().checkpoint();
    const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const count = store.positions.length;
    store.addPosition({
      id, name: `P${count + 1}`,
      x: count * 2, y: 0, z: 0,
      type: 'pyro', color: '#00bbff',
      heading: 0, pitch: 0, roll: 0,
    });
  }, []);

  const handleToggleSelect = useCallback(() => {
    setEditorMode(editorMode === 'select' ? 'add-pyro' : 'select');
  }, [editorMode, setEditorMode]);

  const selectVariant = editorMode === 'select' ? 'active' : 'default';
  
  const actions = hasSelection
    ? [
        { icon: Pencil, label: 'Edit', onClick: () => window.dispatchEvent(new Event('position-double-click')), variant: 'primary' as const },
        { icon: Copy, label: 'Dup', onClick: handleDuplicate, variant: 'default' as const },
        { icon: Trash2, label: 'Del', onClick: handleDelete, variant: 'danger' as const },
      ]
    : [
        { icon: MousePointer2, label: 'Sel', onClick: handleToggleSelect, variant: selectVariant as const },
        { icon: Plus, label: 'Add', onClick: handleAdd, variant: 'default' as const },
        { icon: Undo2, label: 'Undo', onClick: handleUndo, variant: 'default' as const },
        { icon: Redo2, label: 'Redo', onClick: handleRedo, variant: 'default' as const },
      ];

  return (
    <div className="fixed left-3 top-1/2 -translate-y-1/2 z-40 pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        {actions.map(({ icon: Icon, label, onClick, variant }) => (
          <button
            key={label}
            onClick={onClick}
            className={cn(
              "touch-target flex items-center justify-center w-11 h-11 rounded-[14px] glass-button transition-all",
              variant === 'active' && "bg-primary/15 border-primary/30 text-primary glow-active",
              variant === 'primary' && "bg-primary/12 border-primary/25 text-primary",
              variant === 'danger' && "bg-destructive/12 border-destructive/25 text-destructive",
              variant === 'default' && "text-foreground/70"
            )}
            title={label}
          >
            <Icon className="w-5 h-5" />
          </button>
        ))}

        {/* Selection count badge */}
        {hasSelection && (
          <div className="status-pill justify-center">
            <span className="text-[10px] font-bold text-primary tabular-nums">{selectedIds.length}</span>
          </div>
        )}
      </div>
    </div>
  );
}
