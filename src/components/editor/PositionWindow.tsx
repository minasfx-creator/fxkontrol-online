import { useState, useCallback, useMemo, useRef, useEffect, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { MapPin, Plus, Trash2, Copy, ChevronDown, ChevronRight, GripVertical, Search, Flame, Radio, Lightbulb, Hash, ArrowUpDown, MoreHorizontal, Crosshair, Users } from 'lucide-react';
import { useProjectStore, EFFECT_LIBRARY, type Position, type PositionType } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type SortKey = 'name' | 'type' | 'x' | 'y' | 'z' | 'heading' | 'pitch' | 'effects' | 'section';
type SortDir = 'asc' | 'desc';
type FilterTab = 'all' | 'pyro' | 'drone-pad' | 'light';

interface EditingCell {
  posId: string;
  field: 'name' | 'x' | 'y' | 'z' | 'heading' | 'pitch' | 'section';
}

const TYPE_CONFIG: Record<PositionType, { label: string; color: string; icon: typeof Flame }> = {
  'pyro': { label: 'PYRO', color: 'hsl(var(--accent))', icon: Flame },
  'drone-pad': { label: 'DRONE', color: 'hsl(var(--primary))', icon: Radio },
  'light': { label: 'LIGHT', color: 'hsl(50, 95%, 55%)', icon: Lightbulb },
};

const EDITABLE_FIELDS: EditingCell['field'][] = ['name', 'x', 'y', 'z', 'heading', 'pitch', 'section'];

function PositionContextMenu({ x, y, posId, onClose }: { x: number; y: number; posId: string; onClose: () => void }) {
  const { removePosition, positions, addPosition, selectPosition, timelineItems, addTimelineItem, currentTime, selectedPositionIds } = useProjectStore();
  const pos = positions.find(p => p.id === posId);

  useEffect(() => {
    const handler = (e: MouseEvent) => onClose();
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [onClose]);

  if (!pos) return null;

  const handleDuplicate = () => {
    const ids = selectedPositionIds.length > 0 && selectedPositionIds.includes(posId)
      ? selectedPositionIds : [posId];
    ids.forEach(id => {
      const p = positions.find(pp => pp.id === id);
      if (!p) return;
      const newId = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      addPosition({ ...p, id: newId, name: `${p.name}_copy`, x: p.x + 1 });
    });
    toast.success(`${ids.length} posição(ões) duplicada(s)`);
    onClose();
  };

  const handleDelete = () => {
    const ids = selectedPositionIds.length > 0 && selectedPositionIds.includes(posId)
      ? selectedPositionIds : [posId];
    ids.forEach(id => removePosition(id));
    toast.success(`${ids.length} posição(ões) removida(s)`);
    onClose();
  };

  const handleAssignSection = (section: string) => {
    const ids = selectedPositionIds.length > 0 && selectedPositionIds.includes(posId)
      ? selectedPositionIds : [posId];
    const { updatePosition } = useProjectStore.getState();
    ids.forEach(id => updatePosition(id, { section }));
    toast.success(`Seção "${section}" atribuída a ${ids.length} posição(ões)`);
    onClose();
  };

  const menuItems = [
    { label: 'Duplicar', icon: Copy, onClick: handleDuplicate },
    { label: 'Excluir', icon: Trash2, onClick: handleDelete, danger: true },
    { label: 'Seção A', icon: Hash, onClick: () => handleAssignSection('A') },
    { label: 'Seção B', icon: Hash, onClick: () => handleAssignSection('B') },
    { label: 'Seção C', icon: Hash, onClick: () => handleAssignSection('C') },
    { label: 'Focalizar 3D', icon: Crosshair, onClick: () => { selectPosition(posId); onClose(); } },
  ];

  return (
    <div
      className="fixed z-[200] border border-border/30 rounded-xl shadow-2xl shadow-black/60 py-1 min-w-[180px] backdrop-blur-2xl"
      style={{ top: y, left: x, background: 'hsl(var(--popover) / 0.97)' }}
      onClick={e => e.stopPropagation()}
    >
      {menuItems.map(item => (
        <button
          key={item.label}
          onClick={item.onClick}
          className={cn(
            "w-full text-left px-3 py-2 text-[11px] font-medium flex items-center gap-2.5 transition-colors rounded-md mx-1",
            item.danger ? "text-destructive hover:bg-destructive/10" : "text-foreground/80 hover:bg-primary/8"
          )}
          style={{ width: 'calc(100% - 8px)' }}
        >
          <item.icon className="w-3.5 h-3.5 opacity-50" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface PositionWindowProps {
  onClose?: () => void;
}

export default function PositionWindow({ onClose }: PositionWindowProps) {
  const {
    positions, timelineItems, selectedPositionId, selectedPositionIds,
    selectPosition, selectMultiplePositions, togglePositionSelection,
    addPosition, removePosition, updatePosition,
  } = useProjectStore();

  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; posId: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Count effects per position
  const effectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    timelineItems.forEach(item => {
      if (item.positionId) counts[item.positionId] = (counts[item.positionId] || 0) + 1;
      item.positionIds?.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    });
    return counts;
  }, [timelineItems]);

  // Filter & sort
  const filteredPositions = useMemo(() => {
    let list = positions;
    if (filterTab !== 'all') list = list.filter(p => p.type === filterTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.section?.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'type': cmp = a.type.localeCompare(b.type); break;
        case 'x': cmp = a.x - b.x; break;
        case 'y': cmp = a.y - b.y; break;
        case 'z': cmp = a.z - b.z; break;
        case 'heading': cmp = a.heading - b.heading; break;
        case 'pitch': cmp = a.pitch - b.pitch; break;
        case 'effects': cmp = (effectCounts[a.id] || 0) - (effectCounts[b.id] || 0); break;
        case 'section': cmp = (a.section || '').localeCompare(b.section || ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [positions, filterTab, searchQuery, sortKey, sortDir, effectCounts]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleRowClick = useCallback((posId: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      togglePositionSelection(posId);
    } else if (e.ctrlKey || e.metaKey) {
      togglePositionSelection(posId);
    } else {
      selectPosition(posId);
    }
  }, [selectPosition, togglePositionSelection]);

  const startEdit = useCallback((posId: string, field: EditingCell['field']) => {
    const pos = positions.find(p => p.id === posId);
    if (!pos) return;
    const val = field === 'name' ? pos.name
      : field === 'section' ? (pos.section || '')
      : String(pos[field]);
    setEditingCell({ posId, field });
    setEditValue(val);
    setTimeout(() => inputRef.current?.select(), 10);
  }, [positions]);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const { posId, field } = editingCell;

    // Batch: apply to all selected if this pos is in selection
    const targetIds = selectedPositionIds.length > 1 && selectedPositionIds.includes(posId)
      ? selectedPositionIds : [posId];

    targetIds.forEach(id => {
      if (field === 'name' || field === 'section') {
        updatePosition(id, { [field]: editValue });
      } else {
        const num = parseFloat(editValue);
        if (!isNaN(num)) updatePosition(id, { [field]: num });
      }
    });

    setEditingCell(null);
  }, [editingCell, editValue, selectedPositionIds, updatePosition]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitEdit();
      // Move to next row same field
      if (editingCell) {
        const idx = filteredPositions.findIndex(p => p.id === editingCell.posId);
        if (idx < filteredPositions.length - 1) {
          startEdit(filteredPositions[idx + 1].id, editingCell.field);
        }
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      if (editingCell) {
        const fieldIdx = EDITABLE_FIELDS.indexOf(editingCell.field);
        const nextField = e.shiftKey
          ? EDITABLE_FIELDS[(fieldIdx - 1 + EDITABLE_FIELDS.length) % EDITABLE_FIELDS.length]
          : EDITABLE_FIELDS[(fieldIdx + 1) % EDITABLE_FIELDS.length];
        startEdit(editingCell.posId, nextField);
      }
    }
  }, [commitEdit, editingCell, filteredPositions, startEdit]);

  const toggleExpand = (posId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(posId)) next.delete(posId); else next.add(posId);
      return next;
    });
  };

  const handleAddPosition = (type: PositionType) => {
    const prefix = type === 'pyro' ? 'POS' : type === 'drone-pad' ? 'PAD' : 'LT';
    const count = positions.filter(p => p.type === type).length + 1;
    const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    addPosition({
      id, name: `${prefix}-${String(count).padStart(3, '0')}`, type,
      x: 0, y: 0, z: 0, heading: 0, pitch: type === 'pyro' ? 85 : 0, roll: 0,
      color: type === 'pyro' ? '#FF6B35' : type === 'drone-pad' ? '#00B4D8' : '#FBBF24',
    });
    selectPosition(id);
    toast.success(`${prefix}-${String(count).padStart(3, '0')} criada`);
  };

  const handleContextMenu = (e: React.MouseEvent, posId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, posId });
  };

  // Counts per type
  const typeCounts = useMemo(() => ({
    all: positions.length,
    'pyro': positions.filter(p => p.type === 'pyro').length,
    'drone-pad': positions.filter(p => p.type === 'drone-pad').length,
    'light': positions.filter(p => p.type === 'light').length,
  }), [positions]);

  const SortHeader = ({ label, field, w }: { label: string; field: SortKey; w: string }) => (
    <th
      className={cn("px-1.5 py-2 text-left text-[8px] font-bold uppercase tracking-wider cursor-pointer select-none transition-colors hover:text-foreground", w)}
      style={{ color: sortKey === field ? 'hsl(var(--primary))' : undefined }}
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-0.5">
        {label}
        {sortKey === field && <ArrowUpDown className="w-2.5 h-2.5" />}
      </span>
    </th>
  );

  // Keyboard shortcuts: Ctrl+A, Delete, Ctrl+D
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'a') {
        e.preventDefault();
        selectMultiplePositions(filteredPositions.map(p => p.id));
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPositionIds.length > 0) {
          e.preventDefault();
          selectedPositionIds.forEach(id => removePosition(id));
          toast.success(`${selectedPositionIds.length} posição(ões) removida(s)`);
        }
      }
      if (ctrl && e.key === 'd') {
        e.preventDefault();
        const ids = selectedPositionIds.length > 0 ? selectedPositionIds : selectedPositionId ? [selectedPositionId] : [];
        ids.forEach(id => {
          const p = positions.find(pp => pp.id === id);
          if (!p) return;
          const newId = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
          addPosition({ ...p, id: newId, name: `${p.name}_copy`, x: p.x + 1 });
        });
        if (ids.length > 0) toast.success(`${ids.length} posição(ões) duplicada(s)`);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredPositions, selectedPositionIds, selectedPositionId, positions, selectMultiplePositions, removePosition, addPosition]);

  return (
    <div className="h-full flex flex-col" style={{ background: 'hsl(var(--card))' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/10">
        <MapPin className="w-4 h-4 text-primary/60" />
        <span className="text-[11px] font-bold text-foreground uppercase tracking-wider font-display">Position Window</span>
        <span className="text-[9px] text-muted-foreground/40 ml-auto tabular-nums">{positions.length} pos</span>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/8">
        {(['all', 'pyro', 'drone-pad', 'light'] as FilterTab[]).map(tab => {
          const cfg = tab === 'all' ? null : TYPE_CONFIG[tab as PositionType];
          return (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors",
                filterTab === tab
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-surface-1/40"
              )}
            >
              {tab === 'all' ? 'ALL' : cfg?.label} ({typeCounts[tab]})
            </button>
          );
        })}

        {/* Search */}
        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-6 w-24 pl-5 pr-2 text-[9px] rounded-lg bg-surface-0/60 border border-border/20 text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/30"
            />
          </div>
        </div>
      </div>

      {/* Add buttons */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border/8">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] gap-1 text-accent hover:bg-accent/10" onClick={() => handleAddPosition('pyro')}>
          <Plus className="w-3 h-3" /> Pyro
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] gap-1 text-primary hover:bg-primary/10" onClick={() => handleAddPosition('drone-pad')}>
          <Plus className="w-3 h-3" /> Drone
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] gap-1 text-yellow-400 hover:bg-yellow-500/10" onClick={() => handleAddPosition('light')}>
          <Plus className="w-3 h-3" /> Light
        </Button>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 z-10" style={{ background: 'hsl(var(--card))' }}>
            <tr className="border-b border-border/10">
              <th className="w-5 px-1 py-2" />
              <th className="w-5 px-1 py-2 text-[8px] text-muted-foreground/30">#</th>
              <SortHeader label="Name" field="name" w="min-w-[80px]" />
              <SortHeader label="Type" field="type" w="w-12" />
              <SortHeader label="X" field="x" w="w-10" />
              <SortHeader label="Y" field="y" w="w-10" />
              <SortHeader label="Z" field="z" w="w-10" />
              <SortHeader label="H°" field="heading" w="w-10" />
              <SortHeader label="P°" field="pitch" w="w-10" />
              <SortHeader label="FX" field="effects" w="w-8" />
              <SortHeader label="Sec" field="section" w="w-10" />
            </tr>
          </thead>
          <tbody>
            {filteredPositions.map((pos, idx) => {
              const isSelected = selectedPositionId === pos.id || selectedPositionIds.includes(pos.id);
              const cfg = TYPE_CONFIG[pos.type];
              const fxCount = effectCounts[pos.id] || 0;
              const isExpanded = expandedRows.has(pos.id);
              const linkedItems = timelineItems.filter(i => i.positionId === pos.id || i.positionIds?.includes(pos.id));

              const renderCell = (field: EditingCell['field'], value: string, align?: string) => {
                const isEditing = editingCell?.posId === pos.id && editingCell?.field === field;
                if (isEditing) {
                  return (
                    <input
                      ref={inputRef}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={handleEditKeyDown}
                      autoFocus
                      className={cn("w-full h-5 px-1 text-[10px] bg-primary/10 border border-primary/30 rounded outline-none text-foreground font-mono-code", align)}
                    />
                  );
                }
                return (
                  <span
                    className={cn("cursor-text hover:bg-primary/5 px-1 py-0.5 rounded transition-colors block truncate", align)}
                    onDoubleClick={() => startEdit(pos.id, field)}
                  >
                    {value}
                  </span>
                );
              };

              return (
                <tr key={pos.id}>
                  <td colSpan={11} className="p-0">
                    <div>
                      <div
                        onClick={(e) => handleRowClick(pos.id, e)}
                        onContextMenu={(e) => handleContextMenu(e, pos.id)}
                        className={cn(
                          "flex items-center cursor-pointer transition-colors text-[10px]",
                          isSelected
                            ? "bg-primary/10"
                            : idx % 2 === 0
                              ? "bg-transparent hover:bg-muted/20"
                              : "bg-muted/5 hover:bg-muted/20"
                        )}
                      >
                        {/* Expand toggle */}
                        <div className="w-5 px-1 py-[5px] flex items-center justify-center">
                          {fxCount > 0 ? (
                            <button onClick={(e) => { e.stopPropagation(); toggleExpand(pos.id); }} className="text-muted-foreground/30 hover:text-muted-foreground/60">
                              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                          ) : <div className="w-3" />}
                        </div>
                        {/* # */}
                        <div className="w-5 px-1 py-[5px] text-muted-foreground/30 font-mono-code text-right tabular-nums text-[9px]">
                          {idx + 1}
                        </div>
                        {/* Name */}
                        <div className="min-w-[80px] flex-1 px-1.5 py-[5px] font-medium">
                          {renderCell('name', pos.name)}
                        </div>
                        {/* Type */}
                        <div className="w-12 px-1 py-[5px]">
                          <span
                            className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider"
                            style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        {/* X */}
                        <div className="w-10 px-1 py-[5px] font-mono-code text-right tabular-nums text-muted-foreground/60">
                          {renderCell('x', pos.x.toFixed(1), 'text-right')}
                        </div>
                        {/* Y */}
                        <div className="w-10 px-1 py-[5px] font-mono-code text-right tabular-nums text-muted-foreground/60">
                          {renderCell('y', pos.y.toFixed(1), 'text-right')}
                        </div>
                        {/* Z */}
                        <div className="w-10 px-1 py-[5px] font-mono-code text-right tabular-nums text-muted-foreground/60">
                          {renderCell('z', pos.z.toFixed(1), 'text-right')}
                        </div>
                        {/* Heading */}
                        <div className="w-10 px-1 py-[5px] font-mono-code text-right tabular-nums text-accent/60">
                          {renderCell('heading', `${pos.heading}°`, 'text-right')}
                        </div>
                        {/* Pitch */}
                        <div className="w-10 px-1 py-[5px] font-mono-code text-right tabular-nums text-accent/60">
                          {renderCell('pitch', `${pos.pitch}°`, 'text-right')}
                        </div>
                        {/* Effects count */}
                        <div className="w-8 px-1 py-[5px] text-center">
                          {fxCount > 0 ? (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary/12 text-primary tabular-nums">{fxCount}</span>
                          ) : (
                            <span className="text-muted-foreground/20">—</span>
                          )}
                        </div>
                        {/* Section */}
                        <div className="w-10 px-1 py-[5px] text-center">
                          {renderCell('section', pos.section || '—')}
                        </div>
                      </div>

                      {/* Expanded: linked effects */}
                      {isExpanded && linkedItems.length > 0 && (
                        <div className="bg-surface-0/30 border-l-2 border-primary/20 ml-5">
                          {linkedItems.map(item => {
                            const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
                            if (!effect) return null;
                            return (
                              <div key={item.id} className="flex items-center gap-2 px-3 py-1 text-[9px] text-muted-foreground/60 hover:bg-muted/10">
                                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: effect.color }} />
                                <span className="font-medium text-foreground/60 truncate">{effect.name}</span>
                                <span className="font-mono-code tabular-nums ml-auto">{item.startTime.toFixed(1)}s</span>
                                {item.pan !== undefined && <span className="font-mono-code tabular-nums text-accent/40">H{item.pan}°</span>}
                                {item.tilt !== undefined && <span className="font-mono-code tabular-nums text-accent/40">P{item.tilt}°</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredPositions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/30">
            <MapPin className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-[11px]">Nenhuma posição encontrada</span>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border/10 text-[9px] text-muted-foreground/40">
        <span className="flex items-center gap-1"><Flame className="w-3 h-3" style={{ color: 'hsl(var(--accent))' }} /> {typeCounts['pyro']}</span>
        <span className="flex items-center gap-1"><Radio className="w-3 h-3" style={{ color: 'hsl(var(--primary))' }} /> {typeCounts['drone-pad']}</span>
        <span className="flex items-center gap-1"><Lightbulb className="w-3 h-3" style={{ color: 'hsl(50, 95%, 55%)' }} /> {typeCounts['light']}</span>
        <span className="ml-auto tabular-nums">{timelineItems.length} cues</span>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <PositionContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          posId={contextMenu.posId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
