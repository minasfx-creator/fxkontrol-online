/**
 * MobileQuickActions — Compact floating action buttons with drag-and-drop repositioning
 * Auto-hides when bottom sheet is open. Includes micro-labels for discoverability.
 */
import React, { useCallback } from 'react';
import { MousePointer2, Undo2, Redo2, Trash2, Copy, Pencil, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { useProjectStore } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import DraggableFloatingPanel from './DraggableFloatingPanel';

interface MobileQuickActionsProps {
  panelOpen?: boolean;
}

export default React.memo(function MobileQuickActions({ panelOpen = false }: MobileQuickActionsProps) {
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

  const editActions: { icon: typeof Pencil; label: string; onClick: () => void; variant: ActionVariant }[] = hasSelection
    ? [
        { icon: Pencil, label: 'Edit', onClick: () => window.dispatchEvent(new Event('position-double-click')), variant: 'primary' },
        { icon: Compass, label: 'Angle', onClick: handleToggleAngles, variant: angleVariant },
        { icon: Copy, label: 'Dup', onClick: handleDuplicate, variant: 'default' },
        { icon: Trash2, label: 'Del', onClick: handleDelete, variant: 'danger' },
      ]
    : [
        { icon: MousePointer2, label: 'Sel', onClick: handleToggleSelect, variant: selectVariant },
        { icon: Compass, label: 'Angle', onClick: handleToggleAngles, variant: angleVariant },
        { icon: Undo2, label: 'Undo', onClick: handleUndo, variant: 'default' },
        { icon: Redo2, label: 'Redo', onClick: handleRedo, variant: 'default' },
      ];

  return (
    <div className={cn(
      "transition-all duration-200",
      panelOpen && "opacity-0 pointer-events-none translate-y-4"
    )}>
      {/* Edit actions — draggable left panel */}
      <DraggableFloatingPanel panelId="mobile-edit-actions" initialX={Math.round(window.innerWidth - 64)} initialY={Math.round(window.innerHeight * 0.35)} bottomOffset={100}>
        <div className="flex flex-col gap-1.5 p-1.5">
          {editActions.map(({ icon: Icon, label, onClick, variant }) => (
            <button
              key={label}
              onClick={onClick}
              className={cn(
                "flex flex-col items-center justify-center w-12 h-[52px] rounded-xl glass-button transition-all active:scale-90",
                variant === 'active' && "bg-primary/15 border-primary/30 text-primary glow-active",
                variant === 'primary' && "bg-primary/12 border-primary/25 text-primary",
                variant === 'danger' && "bg-destructive/15 border-destructive/30 text-destructive glow-danger",
                variant === 'default' && "text-foreground/70"
              )}
              title={label}
            >
              <Icon className="w-4 h-4" />
              <span className={cn(
                "text-[8px] font-semibold mt-0.5",
                variant === 'active' && "text-primary",
                variant === 'primary' && "text-primary",
                variant === 'danger' && "text-destructive",
                variant === 'default' && "text-muted-foreground/50"
              )}>{label}</span>
            </button>
          ))}
          {hasSelection && (
            <div className="status-pill justify-center px-1.5 py-0.5">
              <span className="text-[9px] font-bold text-primary tabular-nums">{selectedIds.length}</span>
            </div>
          )}
        </div>
      </DraggableFloatingPanel>
    </div>
  );
});
