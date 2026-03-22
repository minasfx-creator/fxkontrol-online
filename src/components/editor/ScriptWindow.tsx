import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  Table, Link2, Unlink, ArrowUpDown, Filter,
  ChevronDown, ChevronRight, Trash2, Copy,
  Clipboard, ClipboardPaste, GripVertical, Plus, Minus,
  Undo2, Redo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore, EFFECT_LIBRARY, type TimelineItem } from '@/store/useProjectStore';
import { getPreFireTime } from '@/lib/safetyEngine';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Helper: compute Finale 3D script row data ────────────────────
function computeScriptRow(item: TimelineItem, positions: ReturnType<typeof useProjectStore.getState>['positions']) {
  const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
  if (!effect) return null;

  const pft = effect.type === 'firework' ? getPreFireTime(effect.name) : 0;
  const effectTime = item.startTime + pft;

  const typePositions = positions.filter((p) =>
    effect.type === 'firework' ? p.type === 'pyro' : p.type === 'drone-pad'
  );
  let posName = item.positionName || 'UNASSIGNED';
  let posHeading = 0;
  if (!item.positionName && typePositions.length > 0) {
    let minDist = Infinity;
    for (const pos of typePositions) {
      const dist = Math.sqrt((pos.x - item.position.x) ** 2 + (pos.z - item.position.z) ** 2);
      if (dist < minDist) {
        minDist = dist;
        posName = pos.name;
        posHeading = pos.heading;
      }
    }
  }

  return {
    id: item.id,
    eventTime: item.startTime,
    effectTime,
    prefire: pft,
    description: effect.name,
    type: effect.type,
    category: effect.category,
    duration: effect.duration,
    cost: effect.cost,
    color: effect.color,
    icon: effect.icon,
    position: posName,
    posHeading,
    pan: item.pan ?? (effect.type === 'firework' ? 90 : 0),
    tilt: item.tilt ?? 0,
    x: item.position.x,
    y: item.position.y,
    z: item.position.z,
    chainRef: item.chainRef,
    chainGap: item.chainGap,
    notes: item.notes || '',
    isChain: !!item.chainRef,
    effectId: item.effectId,
  };
}

type SortField = 'eventTime' | 'effectTime' | 'position' | 'description' | 'cost' | 'duration';
type SortDir = 'asc' | 'desc';

// ─── Clipboard type for copy/paste ─────────────────────────────────
interface ClipboardItem {
  effectId: string;
  position: { x: number; y: number; z: number };
  pan?: number;
  tilt?: number;
  notes?: string;
  timeDelta: number; // relative to first item
  positionDelta: { x: number; z: number }; // relative to first item
}

// ─── Fill Handle config ────────────────────────────────────────────
interface FillConfig {
  count: number;
  timeStep: number;    // seconds between each duplicate
  xStep: number;       // position offset per duplicate
  zStep: number;
  mode: 'time' | 'position' | 'both';
}

export default function ScriptWindow() {
  const {
    timelineItems, positions, selectedTimelineItemId,
    selectTimelineItem, removeTimelineItem, updateTimelineItem,
    combineAsChain, breakChain, addTimelineItem,
  } = useProjectStore();

  const [sortField, setSortField] = useState<SortField>('eventTime');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterText, setFilterText] = useState('');
  const [collapsedChains, setCollapsedChains] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Copy/paste state
  const [clipboard, setClipboard] = useState<ClipboardItem[]>([]);
  
  // Fill handle state
  const [showFillDialog, setShowFillDialog] = useState(false);
  const [fillConfig, setFillConfig] = useState<FillConfig>({
    count: 5,
    timeStep: 0.5,
    xStep: 2,
    zStep: 0,
    mode: 'time',
  });
  const [fillAnchorId, setFillAnchorId] = useState<string | null>(null);
  const [isDraggingFill, setIsDraggingFill] = useState(false);
  const [fillDragCount, setFillDragCount] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  // ─── Inline cell editing state (Finale 3D style) ─────────────────
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const [posDropdown, setPosDropdown] = useState<{ rowId: string } | null>(null);

  // Editable fields in order for Tab navigation
  const EDITABLE_FIELDS = ['eventTime', 'position', 'pan', 'tilt', 'notes'] as const;
  
  // Navigation intent resolved after rows are computed
  const [editNavIntent, setEditNavIntent] = useState<{ dir: 'next-cell' | 'next-row'; fromRowId: string; fromField: string } | null>(null);

  const startEditing = useCallback((rowId: string, field: string, currentValue: string | number) => {
    setEditingCell({ rowId, field });
    setEditDraft(String(currentValue));
    setTimeout(() => editInputRef.current?.select(), 0);
  }, []);

  const commitEdit = useCallback((moveDir?: 'next-cell' | 'next-row' | 'cancel') => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;

    if (moveDir !== 'cancel') {
      const value = editDraft;
      // Apply to all selected rows if batch
      const targetIds = selectedIds.size > 1 && selectedIds.has(rowId)
        ? Array.from(selectedIds) : [rowId];

      targetIds.forEach(id => {
        switch (field) {
          case 'eventTime':
            updateTimelineItem(id, { startTime: parseFloat(value) || 0 });
            break;
          case 'pan':
            updateTimelineItem(id, { pan: parseFloat(value) || 0 });
            break;
          case 'tilt':
            updateTimelineItem(id, { tilt: parseFloat(value) || 0 });
            break;
          case 'notes':
            updateTimelineItem(id, { notes: value });
            break;
        }
      });
    }

    // For next-cell / next-row, we defer to after rows are available
    // by storing intent and resolving in an effect
    if (moveDir === 'next-cell' || moveDir === 'next-row') {
      setEditNavIntent({ dir: moveDir, fromRowId: rowId, fromField: field });
    }

    setEditingCell(null);
  }, [editingCell, editDraft, selectedIds, updateTimelineItem]);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(e.shiftKey ? 'cancel' : 'next-cell');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit('next-row');
    } else if (e.key === 'Escape') {
      commitEdit('cancel');
    }
  }, [commitEdit]);

  // Render an inline editable cell
  const renderEditableCell = (rowId: string, field: string, value: string | number, width: string, extraClass?: string) => {
    const isEditing = editingCell?.rowId === rowId && editingCell?.field === field;
    const isBatchTarget = selectedIds.size > 1 && selectedIds.has(rowId);

    if (isEditing) {
      return (
        <input
          ref={editInputRef}
          type={field === 'notes' ? 'text' : 'number'}
          step={field === 'eventTime' ? '0.001' : '1'}
          className={cn(
            "bg-primary/10 border border-primary/50 text-foreground outline-none rounded-sm px-0.5 transition-colors",
            isBatchTarget && "ring-1 ring-accent/40",
            width
          )}
          value={editDraft}
          onChange={e => setEditDraft(e.target.value)}
          onBlur={() => commitEdit()}
          onKeyDown={handleCellKeyDown}
          autoFocus
        />
      );
    }

    return (
      <span
        className={cn(
          "cursor-text border-b border-transparent hover:border-border/40 transition-colors inline-block",
          width, extraClass
        )}
        onClick={e => { e.stopPropagation(); startEditing(rowId, field, value); }}
      >
        {field === 'eventTime' ? String(value) : String(value)}
      </span>
    );
  };

  // ─── Undo/Redo system ───────────────────────────────────────────
  const undoStack = useRef<TimelineItem[][]>([]);
  const redoStack = useRef<TimelineItem[][]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const MAX_UNDO = 50;

  const pushUndo = useCallback(() => {
    const snapshot = JSON.parse(JSON.stringify(useProjectStore.getState().timelineItems));
    undoStack.current.push(snapshot);
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    setUndoCount(undoStack.current.length);
    setRedoCount(0);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const currentSnapshot = JSON.parse(JSON.stringify(useProjectStore.getState().timelineItems));
    redoStack.current.push(currentSnapshot);
    const prev = undoStack.current.pop()!;
    // Restore: remove all, then add all from snapshot
    const store = useProjectStore.getState();
    store.timelineItems.forEach(i => store.removeTimelineItem(i.id));
    prev.forEach(item => store.addTimelineItem(item));
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
    toast.success('Desfazer');
  }, []);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const currentSnapshot = JSON.parse(JSON.stringify(useProjectStore.getState().timelineItems));
    undoStack.current.push(currentSnapshot);
    const next = redoStack.current.pop()!;
    const store = useProjectStore.getState();
    store.timelineItems.forEach(i => store.removeTimelineItem(i.id));
    next.forEach(item => store.addTimelineItem(item));
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
    toast.success('Refazer');
  }, []);

  // Build script rows
  const rows = useMemo(() => {
    const computed = timelineItems
      .map((item) => computeScriptRow(item, positions))
      .filter(Boolean) as NonNullable<ReturnType<typeof computeScriptRow>>[];

    const filtered = filterText
      ? computed.filter((r) =>
          r.description.toLowerCase().includes(filterText.toLowerCase()) ||
          r.position.toLowerCase().includes(filterText.toLowerCase()) ||
          r.notes.toLowerCase().includes(filterText.toLowerCase())
        )
      : computed;

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'eventTime': return (a.eventTime - b.eventTime) * dir;
        case 'effectTime': return (a.effectTime - b.effectTime) * dir;
        case 'position': return a.position.localeCompare(b.position) * dir;
        case 'description': return a.description.localeCompare(b.description) * dir;
        case 'cost': return (a.cost - b.cost) * dir;
        case 'duration': return (a.duration - b.duration) * dir;
        default: return 0;
      }
    });

    return sorted;
  }, [timelineItems, positions, filterText, sortField, sortDir]);

  // Resolve Tab/Enter navigation after rows are available
  useEffect(() => {
    if (!editNavIntent) return;
    const { dir, fromRowId, fromField } = editNavIntent;
    setEditNavIntent(null);

    if (dir === 'next-cell') {
      const idx = EDITABLE_FIELDS.indexOf(fromField as any);
      if (idx >= 0 && idx < EDITABLE_FIELDS.length - 1) {
        const nextField = EDITABLE_FIELDS[idx + 1];
        const row = rows.find(r => r.id === fromRowId);
        if (row) {
          if (nextField === 'position') {
            setPosDropdown({ rowId: fromRowId });
          } else {
            const val = nextField === 'eventTime' ? row.eventTime
              : nextField === 'pan' ? row.pan
              : nextField === 'tilt' ? row.tilt
              : row.notes;
            startEditing(fromRowId, nextField, val);
          }
        }
      }
    } else if (dir === 'next-row') {
      const rowIdx = rows.findIndex(r => r.id === fromRowId);
      if (rowIdx >= 0 && rowIdx < rows.length - 1) {
        const nextRow = rows[rowIdx + 1];
        const val = fromField === 'eventTime' ? nextRow.eventTime
          : fromField === 'pan' ? nextRow.pan
          : fromField === 'tilt' ? nextRow.tilt
          : nextRow.notes;
        startEditing(nextRow.id, fromField, val);
      }
    }
  }, [editNavIntent, rows, startEditing]);


  const chainGroups = useMemo(() => {
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      if (row.chainRef) {
        const existing = groups.get(row.chainRef) || [];
        existing.push(row);
        groups.set(row.chainRef, existing);
      }
    }
    return groups;
  }, [rows]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleChainCollapse = (chainRef: string) => {
    setCollapsedChains((prev) => {
      const next = new Set(prev);
      if (next.has(chainRef)) next.delete(chainRef);
      else next.add(chainRef);
      return next;
    });
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      // Range select
      const allIds = rows.map(r => r.id);
      const lastSelected = Array.from(selectedIds).pop();
      if (lastSelected) {
        const startIdx = allIds.indexOf(lastSelected);
        const endIdx = allIds.indexOf(id);
        if (startIdx >= 0 && endIdx >= 0) {
          const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          const rangeIds = allIds.slice(from, to + 1);
          setSelectedIds(new Set([...selectedIds, ...rangeIds]));
          return;
        }
      }
    }
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
      selectTimelineItem(id);
    }
  };

  // ─── Copy ────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    if (selectedIds.size === 0) return;
    const items = timelineItems.filter(i => selectedIds.has(i.id));
    if (items.length === 0) return;
    
    const sorted = [...items].sort((a, b) => a.startTime - b.startTime);
    const first = sorted[0];
    
    const clipItems: ClipboardItem[] = sorted.map(item => ({
      effectId: item.effectId,
      position: { ...item.position },
      pan: item.pan,
      tilt: item.tilt,
      notes: item.notes,
      timeDelta: item.startTime - first.startTime,
      positionDelta: {
        x: item.position.x - first.position.x,
        z: item.position.z - first.position.z,
      },
    }));
    
    setClipboard(clipItems);
    toast.success(`${clipItems.length} cue${clipItems.length > 1 ? 's' : ''} copiado(s)`);
  }, [selectedIds, timelineItems]);

  // ─── Cut ─────────────────────────────────────────────────────────
  const handleCut = useCallback(() => {
    pushUndo();
    handleCopy();
    const ids = Array.from(selectedIds);
    ids.forEach(id => removeTimelineItem(id));
    setSelectedIds(new Set());
    toast.success('Cues recortados');
  }, [handleCopy, selectedIds, removeTimelineItem, pushUndo]);

  // ─── Paste ───────────────────────────────────────────────────────
  const handlePaste = useCallback(() => {
    if (clipboard.length === 0) return;
    pushUndo();
    const { currentTime } = useProjectStore.getState();
    const newIds: string[] = [];
    
    clipboard.forEach(clip => {
      const id = `script-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      addTimelineItem({
        id,
        effectId: clip.effectId,
        startTime: currentTime + clip.timeDelta,
        trackIndex: 0,
        position: {
          x: clip.position.x,
          y: clip.position.y,
          z: clip.position.z,
        },
        pan: clip.pan,
        tilt: clip.tilt,
        notes: clip.notes,
      });
      newIds.push(id);
    });
    
    setSelectedIds(new Set(newIds));
    toast.success(`${clipboard.length} cue${clipboard.length > 1 ? 's' : ''} colado(s) em ${currentTime.toFixed(2)}s`);
  }, [clipboard, addTimelineItem, pushUndo]);

  // ─── Duplicate selected ──────────────────────────────────────────
  const handleDuplicate = useCallback(() => {
    if (selectedIds.size === 0) return;
    pushUndo();
    const items = timelineItems.filter(i => selectedIds.has(i.id));
    const newIds: string[] = [];
    
    items.forEach(item => {
      const id = `dup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      addTimelineItem({
        ...item,
        id,
        startTime: item.startTime + 0.5,
        chainRef: undefined,
        chainGap: undefined,
      });
      newIds.push(id);
    });
    
    setSelectedIds(new Set(newIds));
    toast.success(`${items.length} duplicado(s)`);
  }, [selectedIds, timelineItems, addTimelineItem, pushUndo]);

  // ─── Fill Handle: create N copies with incremental offsets ───────
  const handleFill = useCallback(() => {
    const sourceIds = Array.from(selectedIds);
    if (sourceIds.length === 0) return;
    pushUndo();
    
    const items = timelineItems.filter(i => selectedIds.has(i.id));
    const sorted = [...items].sort((a, b) => a.startTime - b.startTime);
    const newIds: string[] = [];
    
    for (let n = 1; n <= fillConfig.count; n++) {
      sorted.forEach(item => {
        const id = `fill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${n}`;
        addTimelineItem({
          ...item,
          id,
          startTime: item.startTime + n * fillConfig.timeStep,
          position: {
            x: item.position.x + n * fillConfig.xStep,
            y: item.position.y,
            z: item.position.z + n * fillConfig.zStep,
          },
          chainRef: undefined,
          chainGap: undefined,
        });
        newIds.push(id);
      });
    }
    
    setSelectedIds(new Set(newIds));
    setShowFillDialog(false);
    toast.success(`${newIds.length} cues gerados via Fill Handle`);
  }, [selectedIds, timelineItems, fillConfig, addTimelineItem, pushUndo]);

  // ─── Fill handle drag ────────────────────────────────────────────
  const handleFillDragStart = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFillAnchorId(id);
    setIsDraggingFill(true);
    setFillDragCount(0);
    
    const startY = e.clientY;
    const rowHeight = 22; // approx row height
    
    const handleMove = (me: MouseEvent) => {
      const deltaY = me.clientY - startY;
      const count = Math.max(0, Math.round(deltaY / rowHeight));
      setFillDragCount(count);
    };
    
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      setIsDraggingFill(false);
      
      // Execute fill with drag count
      setFillDragCount(prev => {
        if (prev > 0) {
          pushUndo();
          const item = timelineItems.find(i => i.id === id);
          if (item) {
            const newIds: string[] = [];
            // Auto-detect time step from surrounding items
            const sorted = [...timelineItems].sort((a, b) => a.startTime - b.startTime);
            const idx = sorted.findIndex(i => i.id === id);
            const timeStep = idx > 0 ? sorted[idx].startTime - sorted[idx - 1].startTime : 0.5;
            
            for (let n = 1; n <= prev; n++) {
              const newId = `drag-fill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${n}`;
              addTimelineItem({
                ...item,
                id: newId,
                startTime: item.startTime + n * Math.max(timeStep, 0.1),
                chainRef: undefined,
                chainGap: undefined,
              });
              newIds.push(newId);
            }
            setSelectedIds(new Set(newIds));
            toast.success(`${prev} cues preenchidos via drag`);
          }
        }
        return 0;
      });
      setFillAnchorId(null);
    };
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [timelineItems, addTimelineItem, pushUndo]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when not in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      
      // Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      // Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        handleCopy();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        handleCut();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        handleDuplicate();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          pushUndo();
          Array.from(selectedIds).forEach(id => removeTimelineItem(id));
          setSelectedIds(new Set());
        }
      }
      // Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(rows.map(r => r.id)));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handleCut, handlePaste, handleDuplicate, handleUndo, handleRedo, selectedIds, rows, removeTimelineItem, pushUndo]);

  const handleCombineChain = () => {
    if (selectedIds.size < 2) return;
    combineAsChain(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleBreakChain = () => {
    const firstId = Array.from(selectedIds)[0];
    const item = timelineItems.find((i) => i.id === firstId);
    if (item?.chainRef) {
      breakChain(item.chainRef);
    }
  };

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${min}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Determine visible rows (handle collapsed chains)
  const visibleRows = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{
      row: typeof rows[0];
      isChainHead: boolean;
      chainCount: number;
      collapsed: boolean;
    }> = [];

    for (const row of rows) {
      if (row.chainRef && collapsedChains.has(row.chainRef)) {
        if (seen.has(row.chainRef)) continue;
        seen.add(row.chainRef);
        const chainItems = chainGroups.get(row.chainRef) || [];
        result.push({
          row: chainItems[0],
          isChainHead: true,
          chainCount: chainItems.length,
          collapsed: true,
        });
      } else {
        result.push({
          row,
          isChainHead: row.chainRef ? (chainGroups.get(row.chainRef)?.[0]?.id === row.id) : false,
          chainCount: row.chainRef ? (chainGroups.get(row.chainRef)?.length || 0) : 0,
          collapsed: false,
        });
      }
    }
    return result;
  }, [rows, collapsedChains, chainGroups]);

  // Stats
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const chainCount = chainGroups.size;
  const pyroCount = rows.filter((r) => r.type === 'firework').length;
  const droneCount = rows.filter((r) => r.type === 'drone').length;

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      {/* Header with stats */}
      <div className="px-3 py-1.5 border-b border-border/40 flex items-center gap-2">
        <Table className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-[11px] font-bold text-foreground uppercase tracking-wider flex-1">Script</h2>
        <div className="flex items-center gap-2 text-[9px] font-mono-code">
          <span className="text-accent">🎆{pyroCount}</span>
          <span className="text-primary">🤖{droneCount}</span>
          <span className="text-muted-foreground">🔗{chainCount}</span>
          <span className="px-1.5 py-0.5 rounded bg-success/10 text-success font-bold">${totalCost.toFixed(0)}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-2 py-1 border-b border-border/30 flex items-center gap-0.5 flex-wrap bg-surface-1/50">
        <div className="relative flex-1 min-w-[80px]">
          <Filter className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
          <Input
            placeholder="Search cues..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="h-6 text-[10px] pl-6 bg-surface-0 border-border/30 focus:border-primary/50"
          />
        </div>
        
        {/* Undo/Redo buttons */}
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          title={`Desfazer (Ctrl+Z) [${undoCount}]`}
          onClick={handleUndo}
          disabled={undoCount === 0}
        >
          <Undo2 className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          title={`Refazer (Ctrl+Shift+Z) [${redoCount}]`}
          onClick={handleRedo}
          disabled={redoCount === 0}
        >
          <Redo2 className="h-3 w-3" />
        </Button>

        <div className="w-px h-4 bg-border mx-0.5" />
        
        {/* Copy/Paste buttons */}
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          title="Copy (Ctrl+C)"
          onClick={handleCopy}
          disabled={selectedIds.size === 0}
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          title="Paste (Ctrl+V)"
          onClick={handlePaste}
          disabled={clipboard.length === 0}
        >
          <ClipboardPaste className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          title="Duplicate (Ctrl+D)"
          onClick={handleDuplicate}
          disabled={selectedIds.size === 0}
        >
          <Clipboard className="h-3 w-3" />
        </Button>
        
        {/* Fill Handle button */}
        <Button
          variant={showFillDialog ? "default" : "ghost"}
          size="icon" className="h-6 w-6"
          title="Fill Handle — distribute copies"
          onClick={() => setShowFillDialog(!showFillDialog)}
          disabled={selectedIds.size === 0}
        >
          <GripVertical className="h-3 w-3" />
        </Button>

        <div className="w-px h-4 bg-border mx-0.5" />
        
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          title="Combine as Chain"
          onClick={handleCombineChain}
          disabled={selectedIds.size < 2}
        >
          <Link2 className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          title="Break Chain"
          onClick={handleBreakChain}
          disabled={selectedIds.size === 0}
        >
          <Unlink className="h-3 w-3" />
        </Button>
        
        {/* Selection info */}
        {selectedIds.size > 0 && (
          <span className="text-[9px] font-mono-code text-primary ml-1">
            {selectedIds.size} sel
          </span>
        )}
        {clipboard.length > 0 && (
          <span className="text-[9px] font-mono-code text-muted-foreground ml-1">
            📋{clipboard.length}
          </span>
        )}
      </div>

      {/* Fill Handle Dialog */}
      {showFillDialog && selectedIds.size > 0 && (
        <div className="px-2 py-2 border-b border-primary/30 bg-primary/5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
            <GripVertical className="h-3 w-3" />
            Fill Handle — Distribuir Cópias
          </div>
          
          {/* Mode selector */}
          <div className="flex gap-1">
            {(['time', 'position', 'both'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setFillConfig(c => ({ ...c, mode }))}
                className={cn(
                  "text-[9px] px-2 py-0.5 rounded-sm font-mono-code transition-colors",
                  fillConfig.mode === mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-muted-foreground hover:text-foreground"
                )}
              >
                {mode === 'time' ? '⏱ Tempo' : mode === 'position' ? '📍 Posição' : '⏱+📍 Ambos'}
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-2 gap-1.5">
            {/* Count */}
            <div>
              <label className="text-[8px] text-muted-foreground uppercase">Cópias</label>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setFillConfig(c => ({ ...c, count: Math.max(1, c.count - 1) }))}
                  className="w-5 h-5 flex items-center justify-center bg-surface-2 rounded-sm text-muted-foreground hover:text-foreground"
                >
                  <Minus className="h-2.5 w-2.5" />
                </button>
                <Input
                  type="number" min={1} max={200}
                  value={fillConfig.count}
                  onChange={(e) => setFillConfig(c => ({ ...c, count: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="h-5 text-[10px] font-mono-code bg-surface-0 border-border text-center px-1 flex-1"
                />
                <button
                  onClick={() => setFillConfig(c => ({ ...c, count: Math.min(200, c.count + 1) }))}
                  className="w-5 h-5 flex items-center justify-center bg-surface-2 rounded-sm text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
            
            {/* Time Step */}
            {(fillConfig.mode === 'time' || fillConfig.mode === 'both') && (
              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Δ Tempo (s)</label>
                <Input
                  type="number" step="0.01" min={0.01}
                  value={fillConfig.timeStep}
                  onChange={(e) => setFillConfig(c => ({ ...c, timeStep: parseFloat(e.target.value) || 0.1 }))}
                  className="h-5 text-[10px] font-mono-code bg-surface-0 border-border px-1"
                />
              </div>
            )}
            
            {/* X Step */}
            {(fillConfig.mode === 'position' || fillConfig.mode === 'both') && (
              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Δ X (m)</label>
                <Input
                  type="number" step="0.5"
                  value={fillConfig.xStep}
                  onChange={(e) => setFillConfig(c => ({ ...c, xStep: parseFloat(e.target.value) || 0 }))}
                  className="h-5 text-[10px] font-mono-code bg-surface-0 border-border px-1"
                />
              </div>
            )}
            
            {/* Z Step */}
            {(fillConfig.mode === 'position' || fillConfig.mode === 'both') && (
              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Δ Z (m)</label>
                <Input
                  type="number" step="0.5"
                  value={fillConfig.zStep}
                  onChange={(e) => setFillConfig(c => ({ ...c, zStep: parseFloat(e.target.value) || 0 }))}
                  className="h-5 text-[10px] font-mono-code bg-surface-0 border-border px-1"
                />
              </div>
            )}
          </div>
          
          {/* Preview info */}
          <div className="text-[8px] text-muted-foreground font-mono-code">
            {selectedIds.size} × {fillConfig.count} = {selectedIds.size * fillConfig.count} novos cues
            {fillConfig.mode !== 'position' && ` · span ${(fillConfig.count * fillConfig.timeStep).toFixed(2)}s`}
            {fillConfig.mode !== 'time' && ` · Δpos (${(fillConfig.count * fillConfig.xStep).toFixed(1)}, ${(fillConfig.count * fillConfig.zStep).toFixed(1)})m`}
          </div>
          
          <Button
            size="sm"
            className="w-full h-6 text-[10px] uppercase tracking-wider"
            onClick={handleFill}
          >
            <GripVertical className="h-3 w-3 mr-1" />
            Preencher {selectedIds.size * fillConfig.count} Cues
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto" ref={tableRef}>
        <table className="w-full text-[9px] font-mono-code border-collapse min-w-[600px]">
          <thead className="sticky top-0 bg-surface-1 z-10">
            <tr className="border-b border-border/40">
              <th className="px-0.5 py-1 w-6 text-center text-muted-foreground/50 font-medium">Cue</th>
              <th className="px-1 py-1 w-5"></th>
              <SortableHeader label="Event Time" field="eventTime" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Effect Time" field="effectTime" current={sortField} dir={sortDir} onSort={toggleSort} />
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">PFT</th>
              <th className="px-1 py-1 text-left text-muted-foreground font-medium w-8">Size</th>
              <th className="px-1 py-1 text-left text-muted-foreground font-medium w-10">Type</th>
              <SortableHeader label="Description" field="description" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Position" field="position" current={sortField} dir={sortDir} onSort={toggleSort} />
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">Pan°</th>
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">Tilt°</th>
              <SortableHeader label="Dur" field="duration" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="$" field="cost" current={sortField} dir={sortDir} onSort={toggleSort} />
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">Chain</th>
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">Notes</th>
              <th className="px-1 py-1 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ row, isChainHead, chainCount, collapsed }, rowIdx) => {
              const isSelected = selectedTimelineItemId === row.id || selectedIds.has(row.id);
              const chainColor = row.chainRef
                ? `hsl(${hashCode(row.chainRef) % 360}, 70%, 50%)`
                : undefined;

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/15 cursor-pointer transition-colors group relative",
                    isSelected
                      ? "bg-primary/15 border-l-2 border-l-primary"
                      : "hover:bg-surface-2/40",
                    row.chainRef && !isSelected && "border-l-2",
                    isDraggingFill && fillAnchorId === row.id && "bg-primary/20",
                  )}
                  style={{
                    ...(row.chainRef && !isSelected ? { borderLeftColor: chainColor } : {}),
                  }}
                  onClick={(e) => toggleSelect(row.id, e)}
                >
                  {/* Cue number */}
                  <td className="px-0.5 py-0.5 text-center text-muted-foreground/40 text-[8px] font-bold">
                    Q{rowIdx + 1}
                  </td>

                  {/* Chain collapse / icon */}
                  <td className="px-0.5 py-0.5 text-center">
                    {isChainHead && chainCount > 1 ? (
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); toggleChainCollapse(row.chainRef!); }}
                      >
                        {collapsed
                          ? <ChevronRight className="h-3 w-3" />
                          : <ChevronDown className="h-3 w-3" />
                        }
                      </button>
                    ) : (
                      <span className="text-[8px]">{row.icon}</span>
                    )}
                  </td>

                  {/* Event Time — click-to-edit with Tab/Enter */}
                  <td className="px-1 py-0.5">
                    {renderEditableCell(row.id, 'eventTime', row.eventTime, 'w-16', 'text-foreground')}
                  </td>

                  {/* Effect Time */}
                  <td className="px-1 py-0.5 text-primary/80">
                    {formatTime(row.effectTime)}
                  </td>

                  {/* Prefire */}
                  <td className="px-1 py-0.5">
                    {row.prefire > 0 ? (
                      <span className="text-warning">{row.prefire.toFixed(1)}s</span>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>

                  {/* Size (Caliber) */}
                  <td className="px-1 py-0.5">
                    {row.type === 'firework' ? (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-accent/15 text-accent tabular-nums">
                        {(() => { const m = row.description.match(/(\d+)(?:in|")/); return m ? `${m[1]}"` : '4"'; })()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>

                  {/* Part Type */}
                  <td className="px-1 py-0.5">
                    <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-muted/20 text-muted-foreground uppercase">
                      {row.category === 'mines' ? 'MINE' : row.category === 'roman_candles' ? 'RC' : row.category === 'cakes_batteries' ? 'CAKE' : row.category === 'waterfalls' ? 'FALL' : row.type === 'firework' ? 'SHELL' : row.type === 'drone' ? 'DRN' : row.type?.slice(0, 3).toUpperCase() || '—'}
                    </span>
                  </td>

                  {/* Description with caliber badge + type icon */}
                  <td className="px-1 py-0.5">
                    <div className="flex items-center gap-1">
                      {/* Section color stripe */}
                      {(() => {
                        const pos = positions.find(p => p.name === row.position);
                        const sec = pos?.section;
                        const sColors: Record<string, string> = { A: '#4CAF50', B: '#2196F3', C: '#FF9800', D: '#E91E63', E: '#9C27B0', F: '#00BCD4' };
                        return <div className="w-[3px] h-4 rounded-full flex-shrink-0" style={{ backgroundColor: sec ? sColors[sec] || '#555' : 'hsl(var(--muted) / 0.2)' }} />;
                      })()}
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/10"
                        style={{ backgroundColor: row.color }}
                      />
                      {/* Caliber badge for pyro */}
                      {row.type === 'firework' && (
                        <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-accent/15 text-accent tabular-nums flex-shrink-0">
                          {(() => { const m = row.description.match(/(\d+)(?:in|")/); return m ? `${m[1]}"` : '4"'; })()}
                        </span>
                      )}
                      {/* Type icon */}
                      {row.category && (
                        <span className="text-[8px] flex-shrink-0 opacity-50">
                          {row.category === 'mines' ? '💥' : row.category === 'roman_candles' ? '🕯️' : row.category === 'cakes_batteries' ? '📦' : row.category === 'waterfalls' ? '💧' : row.type === 'firework' ? '🎆' : ''}
                        </span>
                      )}
                      <span className="text-foreground truncate max-w-[120px] font-medium">
                        {row.description}
                        {collapsed && chainCount > 1 && (
                          <span className="text-muted-foreground ml-1 font-normal">×{chainCount}</span>
                        )}
                      </span>
                    </div>
                  </td>

                  {/* Position — click to assign via dropdown */}
                  <td className="px-1 py-0.5 relative">
                    <span
                      className={cn(
                        "truncate max-w-[80px] block cursor-pointer border-b border-transparent hover:border-border/40 transition-colors",
                        row.position === 'UNASSIGNED' ? "text-destructive/60 italic" : "text-muted-foreground"
                      )}
                      onClick={(e) => { e.stopPropagation(); setPosDropdown(posDropdown?.rowId === row.id ? null : { rowId: row.id }); }}
                    >
                      {row.position}
                    </span>
                    {posDropdown?.rowId === row.id && (
                      <div className="absolute z-50 top-full left-0 mt-0.5 min-w-[120px] max-h-[160px] overflow-y-auto rounded-md border border-border/60 bg-popover/95 p-0.5 shadow-lg backdrop-blur-sm">
                        {positions.filter(p => p.type === 'pyro').map(pos => (
                          <button
                            key={pos.id}
                            className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-[9px] hover:bg-accent/50 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetIds = selectedIds.size > 1 && selectedIds.has(row.id)
                                ? Array.from(selectedIds) : [row.id];
                              targetIds.forEach(id => {
                                updateTimelineItem(id, {
                                  positionId: pos.id,
                                  positionName: pos.name,
                                  position: { x: pos.x, y: pos.y, z: pos.z },
                                });
                              });
                              setPosDropdown(null);
                            }}
                          >
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pos.color }} />
                            <span className="truncate">{pos.name}</span>
                          </button>
                        ))}
                        {positions.filter(p => p.type === 'pyro').length === 0 && (
                          <div className="px-2 py-1 text-[8px] text-muted-foreground/50 italic">No positions</div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Pan — click-to-edit */}
                  <td className="px-1 py-0.5">
                    {renderEditableCell(row.id, 'pan', row.pan, 'w-8', 'text-muted-foreground')}
                  </td>

                  {/* Tilt — click-to-edit */}
                  <td className="px-1 py-0.5">
                    {renderEditableCell(row.id, 'tilt', row.tilt, 'w-8', 'text-muted-foreground')}
                  </td>

                  {/* Duration */}
                  <td className="px-1 py-0.5 text-muted-foreground">{row.duration}s</td>

                  {/* Cost */}
                  <td className="px-1 py-0.5 text-success">${row.cost}</td>

                  {/* Chain */}
                  <td className="px-1 py-0.5">
                    {row.chainRef ? (
                      <div className="flex items-center gap-0.5">
                        <Link2 className="h-2.5 w-2.5" style={{ color: chainColor }} />
                        {row.chainGap != null && row.chainGap > 0 && (
                          <span className="text-[8px] text-muted-foreground">{row.chainGap}ms</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/20">—</span>
                    )}
                  </td>

                  {/* Notes — click-to-edit */}
                  <td className="px-1 py-0.5">
                    {renderEditableCell(row.id, 'notes', row.notes, 'w-full', 'text-muted-foreground text-[8px]')}
                  </td>

                  {/* Actions */}
                  <td className="px-0.5 py-0.5 text-center">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="text-destructive/40 hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeTimelineItem(row.id); }}
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                      {isSelected && (
                        <button
                          className="text-primary/40 hover:text-primary cursor-s-resize"
                          title="Drag down to fill"
                          onMouseDown={(e) => handleFillDragStart(row.id, e)}
                        >
                          <GripVertical className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            
            {/* Fill drag preview rows */}
            {isDraggingFill && fillDragCount > 0 && (
              Array.from({ length: fillDragCount }).map((_, i) => (
                <tr key={`fill-preview-${i}`} className="border-b border-primary/20 bg-primary/5 pointer-events-none">
                  <td colSpan={14} className="px-2 py-0.5 text-[9px] text-primary/60 font-mono-code">
                    + Copy {i + 1}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="px-4 py-10 text-center">
            <Table className="h-8 w-8 text-muted-foreground/15 mx-auto mb-3" />
            <p className="text-[11px] text-muted-foreground/50 font-medium">
              No cues in script
            </p>
            <p className="text-[9px] text-muted-foreground/30 mt-1.5 max-w-[200px] mx-auto leading-relaxed">
              Drag effects from the Asset Palette to the timeline, then they'll appear here for editing
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sortable Header ───────────────────────────────────────────────

function SortableHeader({
  label, field, current, dir, onSort,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const isActive = current === field;
  return (
    <th
      className={cn(
        "px-1 py-1 text-left font-medium cursor-pointer hover:text-foreground transition-colors",
        isActive ? "text-primary" : "text-muted-foreground"
      )}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-0.5">
        {label}
        {isActive && (
          <ArrowUpDown className="h-2 w-2" style={{ transform: dir === 'desc' ? 'scaleY(-1)' : undefined }} />
        )}
      </div>
    </th>
  );
}

// ─── Hash for chain colors ─────────────────────────────────────────

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
