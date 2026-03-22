import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectStore, type Position } from '@/store/useProjectStore';
import { toast } from 'sonner';

/**
 * Right-click context menu for 3D viewport positions.
 * Shows at cursor position with Finale 3D-style actions.
 * Includes section assignment for show segmentation.
 */
export default function PositionContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; posId: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { positions, updatePosition, removePosition, addPosition, selectPosition, selectMultiplePositions, selectedPositionIds } = useProjectStore();

  const pos = menu ? positions.find(p => p.id === menu.posId) : null;
  const multiSelect = selectedPositionIds.length > 1;

  // Listen for context menu events from PositionPins
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setMenu({ x: e.detail.x, y: e.detail.y, posId: e.detail.posId });
    };
    window.addEventListener('position-context-menu' as any, handler as any);
    return () => window.removeEventListener('position-context-menu' as any, handler as any);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!menu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [menu]);

  // Close on Escape
  useEffect(() => {
    if (!menu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [menu]);

  const renamePos = useCallback(() => {
    if (!pos) return;
    const name = prompt('New name:', pos.name);
    if (name) {
      if (multiSelect) {
        const selected = positions.filter(p => selectedPositionIds.includes(p.id));
        selected.forEach((p, i) => updatePosition(p.id, { name: `${name}-${i + 1}` }));
        toast.success(`Renamed ${selected.length} positions`);
      } else {
        updatePosition(pos.id, { name });
      }
    }
    setMenu(null);
  }, [pos, multiSelect, selectedPositionIds, positions, updatePosition]);

  const duplicatePos = useCallback(() => {
    if (!pos) return;
    const targets = multiSelect ? positions.filter(p => selectedPositionIds.includes(p.id)) : [pos];
    const newIds: string[] = [];
    targets.forEach(p => {
      const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      newIds.push(id);
      addPosition({ ...p, id, name: `${p.name}-Copy`, x: p.x + 2, z: p.z + 2 });
    });
    selectMultiplePositions(newIds);
    toast.success(`Duplicated ${targets.length} positions`);
    setMenu(null);
  }, [pos, multiSelect, selectedPositionIds, positions, addPosition, selectMultiplePositions]);

  const deletePos = useCallback(() => {
    if (!pos) return;
    const targets = multiSelect ? [...selectedPositionIds] : [pos.id];
    targets.forEach(id => removePosition(id));
    toast.success(`Deleted ${targets.length} positions`);
    setMenu(null);
  }, [pos, multiSelect, selectedPositionIds, removePosition]);

  const resetHeading = useCallback(() => {
    if (!pos) return;
    const targets = multiSelect ? selectedPositionIds : [pos.id];
    targets.forEach(id => updatePosition(id, { heading: 0 }));
    setMenu(null);
  }, [pos, multiSelect, selectedPositionIds, updatePosition]);

  const pointToCenter = useCallback(() => {
    if (!pos) return;
    const targets = multiSelect ? positions.filter(p => selectedPositionIds.includes(p.id)) : [pos];
    targets.forEach(p => {
      const angle = Math.atan2(-p.x, -p.z) * (180 / Math.PI);
      updatePosition(p.id, { heading: Math.round(angle) });
    });
    toast.success('Pointed to center');
    setMenu(null);
  }, [pos, multiSelect, selectedPositionIds, positions, updatePosition]);

  const moveToOrigin = useCallback(() => {
    if (!pos) return;
    updatePosition(pos.id, { x: 0, z: 0 });
    setMenu(null);
  }, [pos, updatePosition]);

  const selectAll = useCallback(() => {
    selectMultiplePositions(positions.map(p => p.id));
    setMenu(null);
  }, [positions, selectMultiplePositions]);

  const assignSection = useCallback((section: string) => {
    if (!pos) return;
    const targets = multiSelect ? selectedPositionIds : [pos.id];
    targets.forEach(id => updatePosition(id, { section: section || undefined }));
    toast.success(`Section → ${section || 'None'} (${targets.length})`);
    setMenu(null);
  }, [pos, multiSelect, selectedPositionIds, updatePosition]);

  if (!menu || !pos) return null;

  // Collect unique sections from all positions
  const existingSections = Array.from(new Set(positions.map(p => p.section).filter(Boolean) as string[])).sort();

  const items = [
    { label: multiSelect ? `Rename ${selectedPositionIds.length}...` : 'Rename...', action: renamePos },
    { label: multiSelect ? `Duplicate ${selectedPositionIds.length}` : 'Duplicate', action: duplicatePos, shortcut: 'Ctrl+D' },
    { divider: true },
    { label: 'Reset Heading', action: resetHeading },
    { label: 'Point to Center', action: pointToCenter },
    ...(!multiSelect ? [{ label: 'Move to Origin', action: moveToOrigin }] : []),
    { divider: true },
    { label: 'Select All', action: selectAll, shortcut: 'Ctrl+A' },
    { divider: true },
    { label: multiSelect ? `Delete ${selectedPositionIds.length}` : 'Delete', action: deletePos, shortcut: 'Del', danger: true },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-surface-1/95 backdrop-blur-md border border-border/60 rounded-lg shadow-2xl py-1 min-w-[200px]"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="px-3 py-1.5 border-b border-border/40">
        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
          {multiSelect ? `${selectedPositionIds.length} Positions` : pos.name}
        </span>
        {pos.section && (
          <span className="ml-2 text-[8px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold">
            §{pos.section}
          </span>
        )}
      </div>

      {/* Section assignment sub-menu */}
      <div className="px-3 py-1.5 border-b border-border/30">
        <div className="text-[8px] text-muted-foreground/50 font-semibold uppercase tracking-wider mb-1">Section</div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => assignSection('')}
            className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
              !pos.section ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted-foreground hover:bg-surface-2/80'
            }`}
          >
            None
          </button>
          {['A', 'B', 'C', 'D', 'E', 'F'].map(s => (
            <button
              key={s}
              onClick={() => assignSection(s)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                pos.section === s ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted-foreground hover:bg-surface-2/80'
              }`}
            >
              {s}
            </button>
          ))}
          {existingSections.filter(s => !['A','B','C','D','E','F'].includes(s)).map(s => (
            <button
              key={s}
              onClick={() => assignSection(s)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                pos.section === s ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted-foreground hover:bg-surface-2/80'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {items.map((item, i) =>
        'divider' in item ? (
          <div key={i} className="my-1 border-t border-border/30" />
        ) : (
          <button
            key={i}
            onClick={item.action}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-surface-2 transition-colors ${
              item.danger ? 'text-destructive hover:text-destructive' : 'text-foreground'
            }`}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="text-[9px] text-muted-foreground font-mono">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
}
