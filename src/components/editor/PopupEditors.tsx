import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Move, Trash2, Copy, RotateCcw, GripVertical, Link, Unlink, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjectStore, EFFECT_LIBRARY, type Position } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Floating pop-up editor for a position */
export function PositionPopupEditor({ onClose }: { onClose: () => void }) {
  const { selectedPositionId, selectedPositionIds, positions, updatePosition, removePosition, timelineItems, removeTimelineItem } = useProjectStore();
  const pos = positions.find(p => p.id === selectedPositionId);
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const [windowPos, setWindowPos] = useState({ x: 80, y: 80 });
  const dragStart = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'props' | 'effects'>('props');

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
  const isMulti = selectedPositionIds.length > 1;

  const handleDuplicate = () => {
    const store = useProjectStore.getState();
    const targetIds = isMulti ? selectedPositionIds : [pos.id];
    targetIds.forEach(tid => {
      const p = store.positions.find(pp => pp.id === tid);
      if (!p) return;
      const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      store.addPosition({ ...p, id, name: `${p.name}-Copy`, x: p.x + 2, z: p.z + 2 });
    });
    toast.success(`${targetIds.length} posição(ões) duplicada(s)`);
  };

  const handleDelete = () => {
    const store = useProjectStore.getState();
    const targetIds = isMulti ? selectedPositionIds : [pos.id];
    targetIds.forEach(id => store.removePosition(id));
    onClose();
    toast.success(`${targetIds.length} posição(ões) removida(s)`);
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
      className="fixed z-50 bg-card/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl"
      style={{ left: windowPos.x, top: windowPos.y, width: 300 }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b border-border/60 cursor-move select-none rounded-t-lg"
        style={{ background: `linear-gradient(135deg, ${color}15, transparent)` }}
        onMouseDown={(e) => {
          dragStart.current = { x: e.clientX - windowPos.x, y: e.clientY - windowPos.y };
          setIsDraggingWindow(true);
        }}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground" />
        <div className="w-3 h-3 rounded-full border border-border/50" style={{ backgroundColor: color }} />
        <span className="text-xs font-bold text-foreground flex-1 truncate">{pos.name}</span>
        {isMulti && (
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-bold">
            {selectedPositionIds.length} sel
          </span>
        )}
        <span className="text-[9px] text-muted-foreground uppercase font-mono">{pos.type === 'pyro' ? 'Pyro' : 'Drone'}</span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-accent/10 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border/40 px-1">
        {(['props', 'effects'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
              activeTab === tab ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === 'props' ? 'Properties' : `Effects (${linkedItems.length})`}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-3">
        {activeTab === 'props' && (
          <>
            {/* Name */}
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Name</label>
              <Input
                value={pos.name}
                onChange={(e) => updatePosition(pos.id, { name: e.target.value })}
                className="h-7 text-xs font-medium bg-muted/50 border-border"
              />
            </div>

            {/* Coordinates */}
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Position (m)</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'X', value: pos.x, key: 'x' as const, c: 'hsl(var(--destructive))' },
                  { label: 'Y', value: pos.y, key: 'y' as const, c: 'hsl(120, 60%, 45%)' },
                  { label: 'Z', value: pos.z, key: 'z' as const, c: 'hsl(var(--primary))' },
                ].map(f => (
                  <div key={f.key} className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold" style={{ color: f.c }}>{f.label}</span>
                    <Input
                      type="number"
                      step={0.5}
                      value={f.value}
                      onChange={(e) => updatePosition(pos.id, { [f.key]: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-[10px] font-mono pl-5 bg-muted/50 border-border"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Heading */}
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Heading</label>
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

            {/* Color override for drones */}
            {pos.type === 'drone-pad' && (
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">LED Color</label>
                <input
                  type="color"
                  value={pos.color}
                  onChange={(e) => updatePosition(pos.id, { color: e.target.value })}
                  className="w-full h-6 rounded border border-border cursor-pointer"
                />
              </div>
            )}
          </>
        )}

        {activeTab === 'effects' && (
          <ScrollArea className="max-h-48">
            {linkedItems.length > 0 ? (
              <div className="space-y-1 pr-2">
                {linkedItems.map(item => {
                  const eff = EFFECT_LIBRARY.find(e => e.id === item.effectId);
                  return (
                    <div key={item.id} className="flex items-center gap-1.5 bg-muted/50 rounded px-2 py-1 group">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: eff?.color || '#888' }} />
                      <span className="text-[10px] flex-1 truncate font-medium">{eff?.name || item.effectId}</span>
                      <span className="text-[9px] text-muted-foreground font-mono">{item.startTime.toFixed(1)}s</span>
                      <button
                        onClick={() => removeTimelineItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 rounded transition-opacity"
                      >
                        <Unlink className="w-2.5 h-2.5 text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <Link className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-[10px] text-muted-foreground">Nenhum efeito vinculado</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Double-click em efeitos na palette</p>
              </div>
            )}
          </ScrollArea>
        )}

        {/* Actions */}
        <div className="flex gap-1.5 pt-1 border-t border-border/30">
          <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1" onClick={handleDuplicate}>
            <Copy className="w-3 h-3" /> Duplicar{isMulti ? ` (${selectedPositionIds.length})` : ''}
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1 text-destructive hover:text-destructive border-destructive/30" onClick={handleDelete}>
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
  const { removePosition, updatePosition, addPosition, selectPosition } = useProjectStore();
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
      className="fixed z-[60] bg-card/95 backdrop-blur-xl border border-border rounded-md shadow-2xl py-1 min-w-[160px]"
      style={{ left: screenPos.x, top: screenPos.y }}
    >
      <div className="px-3 py-1.5 border-b border-border/40 flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: position.type === 'pyro' ? '#FF6B35' : '#00B4D8' }} />
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
              "w-full flex items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-accent/10 transition-colors",
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
    { keys: ['E'], desc: 'Position editor popup' },
    { keys: ['Space'], desc: 'Play / Pause' },
    { keys: ['Shift', 'Click'], desc: 'Multi-select positions' },
    { keys: ['Ctrl', 'Drag'], desc: 'Snap to grid (0.5m)' },
    { keys: ['Ctrl', 'S'], desc: 'Save project' },
    { keys: ['Ctrl', 'O'], desc: 'Open project' },
    { keys: ['Del'], desc: 'Delete selected' },
    { keys: ['Ctrl', 'D'], desc: 'Duplicate selected' },
    { keys: ['Ctrl', 'Z'], desc: 'Undo' },
    { keys: ['Shift', '?'], desc: 'Show shortcuts' },
    { keys: ['Esc'], desc: 'Cancel / Close' },
  ];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-6 w-80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent/10 text-muted-foreground">
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
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono text-foreground">
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
