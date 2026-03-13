import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Move, Trash2, Copy, Link2, RotateCcw, MapPin, Zap, Settings2, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useProjectStore, EFFECT_LIBRARY, type Position } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Floating pop-up editor for a position — appears near the selected pin */
export function PositionPopupEditor({ onClose }: { onClose: () => void }) {
  const { selectedPositionId, positions, updatePosition, removePosition, timelineItems, removeTimelineItem } = useProjectStore();
  const pos = positions.find(p => p.id === selectedPositionId);
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const [windowPos, setWindowPos] = useState({ x: 80, y: 120 });
  const dragStart = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDraggingWindow) return;
    const onMove = (e: MouseEvent) => {
      setWindowPos({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };
    const onUp = () => setIsDraggingWindow(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDraggingWindow]);

  if (!pos) return null;

  const color = pos.type === 'pyro' ? '#FF6B35' : '#00B4D8';
  const linkedItems = timelineItems.filter(t => t.positionId === pos.id);

  const handleDuplicate = () => {
    const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const store = useProjectStore.getState();
    store.addPosition({
      ...pos,
      id,
      name: `${pos.name}-Copy`,
      x: pos.x + 2,
      z: pos.z + 2,
    });
    store.selectPosition(id);
    toast.success('Posição duplicada');
  };

  const handleDelete = () => {
    removePosition(pos.id);
    onClose();
    toast.success('Posição removida');
  };

  const handleDeleteWithEffects = () => {
    linkedItems.forEach(item => removeTimelineItem(item.id));
    removePosition(pos.id);
    onClose();
    toast.success(`Posição e ${linkedItems.length} efeitos removidos`);
  };

  return (
    <div
      ref={windowRef}
      className="fixed z-50 bg-surface-1/95 backdrop-blur-lg border border-border/80 rounded-lg shadow-2xl"
      style={{ left: windowPos.x, top: windowPos.y, width: 280 }}
    >
      {/* Title bar — draggable */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border/60 cursor-move select-none"
        onMouseDown={(e) => {
          dragStart.current = { x: e.clientX - windowPos.x, y: e.clientY - windowPos.y };
          setIsDraggingWindow(true);
        }}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground" />
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-bold text-foreground flex-1 truncate">{pos.name}</span>
        <span className="text-[9px] text-muted-foreground uppercase">{pos.type === 'pyro' ? 'Pyro' : 'Drone'}</span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-surface-3 text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Name */}
        <Input
          value={pos.name}
          onChange={(e) => updatePosition(pos.id, { name: e.target.value })}
          className="h-7 text-xs font-medium bg-surface-2 border-border"
        />

        {/* Coordinates */}
        <div className="space-y-1">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Position</p>
          <div className="grid grid-cols-3 gap-1">
            {[
              { label: 'X', value: pos.x, key: 'x' as const, c: '#ef4444' },
              { label: 'Y', value: pos.y, key: 'y' as const, c: '#22c55e' },
              { label: 'Z', value: pos.z, key: 'z' as const, c: '#3b82f6' },
            ].map(f => (
              <div key={f.key} className="relative">
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold" style={{ color: f.c }}>{f.label}</span>
                <Input
                  type="number"
                  step={0.5}
                  value={f.value}
                  onChange={(e) => updatePosition(pos.id, { [f.key]: parseFloat(e.target.value) || 0 })}
                  className="h-6 text-[10px] font-mono pl-5 bg-surface-2 border-border"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-1">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Heading</p>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={360}
              value={pos.heading}
              onChange={(e) => updatePosition(pos.id, { heading: parseInt(e.target.value) })}
              className="flex-1 h-1 accent-primary"
            />
            <span className="text-[10px] font-mono text-foreground w-8 text-right">{pos.heading}°</span>
          </div>
        </div>

        {/* Linked effects */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Efeitos Vinculados</p>
            <span className="text-[9px] text-muted-foreground">{linkedItems.length}</span>
          </div>
          {linkedItems.length > 0 ? (
            <div className="max-h-20 overflow-y-auto space-y-0.5">
              {linkedItems.map(item => {
                const eff = EFFECT_LIBRARY.find(e => e.id === item.effectId);
                return (
                  <div key={item.id} className="flex items-center gap-1.5 bg-surface-2 rounded px-2 py-0.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: eff?.color || '#888' }} />
                    <span className="text-[10px] flex-1 truncate">{eff?.name || item.effectId}</span>
                    <span className="text-[9px] text-muted-foreground font-mono">{item.startTime.toFixed(1)}s</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[9px] text-muted-foreground italic">Nenhum efeito. Double-click na palette para adicionar.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="flex-1 h-7 text-[10px] gap-1" onClick={handleDuplicate}>
            <Copy className="w-3 h-3" /> Duplicar
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 h-7 text-[10px] gap-1 text-destructive hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="w-3 h-3" /> Remover
          </Button>
        </div>
        {linkedItems.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-6 text-[9px] text-destructive hover:text-destructive"
            onClick={handleDeleteWithEffects}
          >
            Remover com {linkedItems.length} efeito{linkedItems.length > 1 ? 's' : ''}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Floating context menu for right-click on positions */
export function PositionContextMenu({
  position,
  screenPos,
  onClose,
}: {
  position: Position;
  screenPos: { x: number; y: number };
  onClose: () => void;
}) {
  const { removePosition, updatePosition, positions, addPosition, selectPosition } = useProjectStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    {
      label: 'Duplicate',
      icon: Copy,
      action: () => {
        const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        addPosition({ ...position, id, name: `${position.name}-Copy`, x: position.x + 2, z: position.z + 2 });
        selectPosition(id);
        toast.success('Posição duplicada');
      },
    },
    {
      label: 'Reset Heading',
      icon: RotateCcw,
      action: () => { updatePosition(position.id, { heading: 0 }); toast.success('Heading resetado'); },
    },
    {
      label: 'Move to Origin',
      icon: Move,
      action: () => { updatePosition(position.id, { x: 0, z: 0 }); toast.success('Movido para origem'); },
    },
    { divider: true as const },
    {
      label: 'Delete',
      icon: Trash2,
      action: () => { removePosition(position.id); toast.success('Posição removida'); },
      destructive: true,
    },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[60] bg-surface-1/95 backdrop-blur-lg border border-border/80 rounded-md shadow-2xl py-1 min-w-[160px]"
      style={{ left: screenPos.x, top: screenPos.y }}
    >
      <div className="px-3 py-1.5 border-b border-border/40 flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: position.type === 'pyro' ? PYRO_COLOR : DRONE_COLOR }} />
        <span className="text-[10px] font-bold text-foreground">{position.name}</span>
      </div>
      {items.map((item, i) => {
        if ('divider' in item) return <div key={i} className="border-t border-border/30 my-0.5" />;
        const Icon = item.icon;
        return (
          <button
            key={i}
            onClick={() => { item.action(); onClose(); }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-surface-3 transition-colors",
              item.destructive ? "text-destructive" : "text-foreground"
            )}
          >
            <Icon className="w-3 h-3" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Keyboard shortcuts overlay */
export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: ['V'], desc: 'Select mode' },
    { keys: ['Space'], desc: 'Play / Pause' },
    { keys: ['Shift', 'Click'], desc: 'Multi-select positions' },
    { keys: ['Ctrl', 'Drag'], desc: 'Snap to grid (0.5m)' },
    { keys: ['Ctrl', 'S'], desc: 'Save project' },
    { keys: ['Ctrl', 'O'], desc: 'Open project' },
    { keys: ['Del'], desc: 'Delete selected' },
    { keys: ['Ctrl', 'D'], desc: 'Duplicate selected' },
    { keys: ['Ctrl', 'Z'], desc: 'Undo' },
    { keys: ['Esc'], desc: 'Cancel / Close' },
  ];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="bg-surface-1/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl p-6 w-80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-3 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.desc}</span>
              <div className="flex items-center gap-0.5">
                {s.keys.map((k, j) => (
                  <span key={j}>
                    <kbd className="px-1.5 py-0.5 rounded bg-surface-3 border border-border text-[10px] font-mono text-foreground">
                      {k}
                    </kbd>
                    {j < s.keys.length - 1 && <span className="text-[9px] text-muted-foreground mx-0.5">+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
