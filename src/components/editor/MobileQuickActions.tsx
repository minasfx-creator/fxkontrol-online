/**
 * MobileQuickActions — Apple-style floating action buttons
 * Contextual, minimal, with smooth spring animations.
 */
import { useCallback } from 'react';
import { MousePointer2, Plus, Undo2, Redo2, Trash2, Copy, Pencil, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { useProjectStore } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';

export default function MobileQuickActions() {
  const selectedIds = useProjectStore(s => s.selectedPositionIds);
  const editorMode = useProjectStore(s => s.editorMode);
  const setEditorMode = useProjectStore(s => s.setEditorMode);
  const hasSelection = selectedIds.length > 0;

  const handleUndo = useCallback(() => { haptics.tap(); useUndoStore.getState().undo(); }, []);
  const handleRedo = useCallback(() => { haptics.tap(); useUndoStore.getState().redo(); }, []);

  const handleDelete = useCallback(() => {
    haptics.fire();
    const store = useProjectStore.getState();
    useUndoStore.getState().checkpoint();
    store.selectedPositionIds.forEach(id => store.removePosition(id));
  }, []);

  const handleDuplicate = useCallback(() => {
    haptics.toggle();
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
    haptics.tap();
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
    haptics.select();
    setEditorMode(editorMode === 'select' ? 'add-pyro' : 'select');
  }, [editorMode, setEditorMode]);

  type ActionVariant = 'primary' | 'default' | 'danger' | 'active';
  const selectVariant: ActionVariant = editorMode === 'select' ? 'active' : 'default';
  const angleVariant: ActionVariant = editorMode === 'adjust-angles' ? 'active' : 'default';
  
  const handleToggleAngles = useCallback(() => {
    haptics.select();
    setEditorMode(editorMode === 'adjust-angles' ? 'select' : 'adjust-angles');
  }, [editorMode, setEditorMode]);

  const actions: { icon: typeof Pencil; label: string; onClick: () => void; variant: ActionVariant }[] = hasSelection
    ? [
        { icon: Pencil, label: 'Edit', onClick: () => window.dispatchEvent(new Event('position-double-click')), variant: 'primary' },
        { icon: Compass, label: 'Angle', onClick: handleToggleAngles, variant: angleVariant },
        { icon: Copy, label: 'Dup', onClick: handleDuplicate, variant: 'default' },
        { icon: Trash2, label: 'Del', onClick: handleDelete, variant: 'danger' },
      ]
    : [
        { icon: MousePointer2, label: 'Sel', onClick: handleToggleSelect, variant: selectVariant },
        { icon: Compass, label: 'Angle', onClick: handleToggleAngles, variant: angleVariant },
        { icon: Plus, label: 'Add', onClick: handleAdd, variant: 'default' },
        { icon: Undo2, label: 'Undo', onClick: handleUndo, variant: 'default' },
        { icon: Redo2, label: 'Redo', onClick: handleRedo, variant: 'default' },
      ];

  return (
    <div className="fixed left-3 top-1/2 -translate-y-1/2 z-40 pointer-events-none">
      <div className="flex flex-col gap-2.5 pointer-events-auto">
        {actions.map(({ icon: Icon, label, onClick, variant }) => (
          <button
            key={label}
            onClick={onClick}
            className={cn(
              "touch-target-lg flex flex-col items-center justify-center w-14 h-14 rounded-2xl glass-button transition-all active:scale-90",
              variant === 'active' && "bg-primary/15 border-primary/30 text-primary glow-active",
              variant === 'primary' && "bg-primary/12 border-primary/25 text-primary",
              variant === 'danger' && "bg-destructive/15 border-destructive/30 text-destructive glow-danger",
              variant === 'default' && "text-foreground/70"
            )}
            title={label}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[8px] font-bold mt-0.5 uppercase tracking-wider opacity-70">{label}</span>
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
