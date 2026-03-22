import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectStore, EFFECT_LIBRARY, type Position } from '@/store/useProjectStore';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Unlink, Link, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Right-click context menu for 3D viewport positions.
 * Unified Finale 3D-style: rotation commands, quick props, linked effects, section assignment.
 */
export default function PositionContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; posId: string } | null>(null);
  const [showProps, setShowProps] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { positions, updatePosition, removePosition, addPosition, selectPosition, selectMultiplePositions, selectedPositionIds, timelineItems, removeTimelineItem } = useProjectStore();

  const pos = menu ? positions.find(p => p.id === menu.posId) : null;
  const multiSelect = selectedPositionIds.length > 1;

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setMenu({ x: e.detail.x, y: e.detail.y, posId: e.detail.posId });
      setShowProps(false);
      setShowEffects(false);
    };
    window.addEventListener('position-context-menu' as any, handler as any);
    return () => window.removeEventListener('position-context-menu' as any, handler as any);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [menu]);

  const emitAxisMode = useCallback((axis: string) => {
    window.dispatchEvent(new CustomEvent('angle-mode-axis', { detail: { axis } }));
    useProjectStore.getState().setEditorMode('adjust-angles');
    setMenu(null);
  }, []);

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

  const linkedItems = timelineItems.filter(t => t.positionId === pos.id);
  const existingSections = Array.from(new Set(positions.map(p => p.section).filter(Boolean) as string[])).sort();

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-surface-1/95 backdrop-blur-md border border-border/60 rounded-lg shadow-2xl py-1 min-w-[220px] max-h-[80vh] overflow-y-auto"
      style={{ left: menu.x, top: menu.y }}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-border/40">
        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
          {multiSelect ? `${selectedPositionIds.length} Positions` : pos.name}
        </span>
        {pos.section && (
          <span className="ml-2 text-[8px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold">§{pos.section}</span>
        )}
      </div>

      {/* ── Quick Props (collapsible) ── */}
      <div className="border-b border-border/30">
        <button
          onClick={() => setShowProps(!showProps)}
          className="w-full text-left px-3 py-1.5 text-[10px] font-semibold text-muted-foreground flex items-center gap-1 hover:bg-surface-2 transition-colors"
        >
          {showProps ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Properties
        </button>
        {showProps && (
          <div className="px-3 pb-2 space-y-1.5">
            {/* Name */}
            <Input
              value={pos.name}
              onChange={(e) => updatePosition(pos.id, { name: e.target.value })}
              className="h-6 text-[10px] font-medium bg-muted/50 border-border"
              placeholder="Name"
            />
            {/* XYZ row */}
            <div className="grid grid-cols-3 gap-1">
              {([
                { label: 'X', key: 'x' as const, value: pos.x, color: 'hsl(0, 70%, 55%)' },
                { label: 'Y', key: 'y' as const, value: pos.y, color: 'hsl(120, 60%, 45%)' },
                { label: 'Z', key: 'z' as const, value: pos.z, color: 'hsl(210, 70%, 55%)' },
              ]).map(f => (
                <div key={f.key} className="relative">
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold" style={{ color: f.color }}>{f.label}</span>
                  <Input
                    type="number" step={0.5} value={f.value}
                    onChange={(e) => updatePosition(pos.id, { [f.key]: parseFloat(e.target.value) || 0 })}
                    className="h-5 text-[9px] font-mono pl-4 bg-muted/50 border-border"
                  />
                </div>
              ))}
            </div>
            {/* HPR row */}
            <div className="grid grid-cols-3 gap-1">
              {([
                { label: 'H', key: 'heading' as const, value: pos.heading, color: '#4FC3F7', min: -360, max: 360 },
                { label: 'P', key: 'pitch' as const, value: pos.pitch || 85, color: '#FF8A65', min: -180, max: 180 },
                { label: 'R', key: 'roll' as const, value: pos.roll || 0, color: '#66BB6A', min: -180, max: 180 },
              ]).map(f => (
                <div key={f.key} className="relative">
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold" style={{ color: f.color }}>{f.label}</span>
                  <Input
                    type="number" step={1} value={f.value} min={f.min} max={f.max}
                    onChange={(e) => updatePosition(pos.id, { [f.key]: parseFloat(e.target.value) || 0 })}
                    className="h-5 text-[9px] font-mono pl-4 bg-muted/50 border-border"
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground">°</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Linked Effects (collapsible) ── */}
      <div className="border-b border-border/30">
        <button
          onClick={() => setShowEffects(!showEffects)}
          className="w-full text-left px-3 py-1.5 text-[10px] font-semibold text-muted-foreground flex items-center gap-1 hover:bg-surface-2 transition-colors"
        >
          {showEffects ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Effects ({linkedItems.length})
        </button>
        {showEffects && (
          <div className="px-3 pb-2">
            {linkedItems.length > 0 ? (
              <ScrollArea className="max-h-28">
                <div className="space-y-0.5 pr-1">
                  {linkedItems.map(item => {
                    const eff = EFFECT_LIBRARY.find(e => e.id === item.effectId);
                    return (
                      <div key={item.id} className="flex items-center gap-1 bg-muted/30 rounded px-1.5 py-0.5 group">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: eff?.color || '#888' }} />
                        <span className="text-[9px] flex-1 truncate">{eff?.name || item.effectId}</span>
                        <span className="text-[8px] text-muted-foreground font-mono">{item.startTime.toFixed(1)}s</span>
                        <button
                          onClick={() => removeTimelineItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 rounded"
                        >
                          <Unlink className="w-2.5 h-2.5 text-destructive" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-2">
                <Link className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                <p className="text-[9px] text-muted-foreground">No linked effects</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section Assignment ── */}
      <div className="px-3 py-1.5 border-b border-border/30">
        <div className="text-[8px] text-muted-foreground/50 font-semibold uppercase tracking-wider mb-1">Section</div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => assignSection('')}
            className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
              !pos.section ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted-foreground hover:bg-surface-2/80'
            }`}
          >None</button>
          {['A', 'B', 'C', 'D', 'E', 'F'].map(s => (
            <button
              key={s}
              onClick={() => assignSection(s)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                pos.section === s ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted-foreground hover:bg-surface-2/80'
              }`}
            >{s}</button>
          ))}
          {existingSections.filter(s => !['A','B','C','D','E','F'].includes(s)).map(s => (
            <button
              key={s}
              onClick={() => assignSection(s)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                pos.section === s ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted-foreground hover:bg-surface-2/80'
              }`}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* ── Rotation Commands (Finale 3D-style) ── */}
      <div className="border-b border-border/30">
        <div className="px-3 py-1 text-[8px] text-muted-foreground/50 font-semibold uppercase tracking-wider">Rotate</div>
        {[
          { label: 'Heading', axis: 'heading', color: '#4FC3F7' },
          { label: 'Pitch', axis: 'pitch', color: '#FF8A65' },
          { label: 'Roll', axis: 'roll', color: '#66BB6A' },
          { label: 'Around Up Vector', axis: 'up-vector', color: '#AB47BC' },
        ].map(r => (
          <button
            key={r.axis}
            onClick={() => emitAxisMode(r.axis)}
            className="w-full text-left px-3 py-1 text-xs flex items-center gap-2 hover:bg-surface-2 transition-colors text-foreground"
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
            <span>{r.label}</span>
            <span className="text-[8px] text-muted-foreground ml-auto font-mono">{r.axis === 'up-vector' ? 'U' : r.axis[0].toUpperCase()}</span>
          </button>
        ))}
      </div>

      {/* ── Move on Axis ── */}
      <button
        onClick={() => {
          window.dispatchEvent(new CustomEvent('move-on-axis', { detail: { posId: pos.id } }));
          setMenu(null);
        }}
        className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-surface-2 transition-colors text-foreground"
      >
        <span className="w-2 h-2 rounded-full bg-yellow-500" />
        <span>Move on Axis...</span>
      </button>

      {/* ── Standard Actions ── */}
      {[
        { label: multiSelect ? `Rename ${selectedPositionIds.length}...` : 'Rename...', action: renamePos },
        { label: multiSelect ? `Duplicate ${selectedPositionIds.length}` : 'Duplicate', action: duplicatePos, shortcut: 'Ctrl+D' },
      ].map((item, i) => (
        <button
          key={i}
          onClick={item.action}
          className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-surface-2 transition-colors text-foreground"
        >
          <span>{item.label}</span>
          {item.shortcut && <span className="text-[9px] text-muted-foreground font-mono">{item.shortcut}</span>}
        </button>
      ))}

      <div className="my-1 border-t border-border/30" />

      <button onClick={resetHeading} className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-2 transition-colors text-foreground">
        Reset Heading
      </button>
      <button onClick={pointToCenter} className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-2 transition-colors text-foreground">
        Point to Center
      </button>
      {!multiSelect && (
        <button onClick={moveToOrigin} className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-2 transition-colors text-foreground">
          Move to Origin
        </button>
      )}

      <div className="my-1 border-t border-border/30" />

      <button onClick={selectAll} className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-surface-2 transition-colors text-foreground">
        <span>Select All</span>
        <span className="text-[9px] text-muted-foreground font-mono">Ctrl+A</span>
      </button>

      <div className="my-1 border-t border-border/30" />

      <button onClick={deletePos} className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-surface-2 transition-colors text-destructive hover:text-destructive">
        <span>{multiSelect ? `Delete ${selectedPositionIds.length}` : 'Delete'}</span>
        <span className="text-[9px] text-muted-foreground font-mono">Del</span>
      </button>
    </div>
  );
}
