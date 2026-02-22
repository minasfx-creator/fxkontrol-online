import { useMemo, useState, useCallback } from 'react';
import {
  Table, Link2, Unlink, ArrowUpDown, Filter,
  ChevronDown, ChevronRight, Trash2, Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore, EFFECT_LIBRARY, type TimelineItem } from '@/store/useProjectStore';
import { getPreFireTime } from '@/lib/safetyEngine';
import { cn } from '@/lib/utils';

// ─── Helper: compute Finale 3D script row data ────────────────────
function computeScriptRow(item: TimelineItem, positions: ReturnType<typeof useProjectStore.getState>['positions']) {
  const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
  if (!effect) return null;

  const pft = effect.type === 'firework' ? getPreFireTime(effect.name) : 0;
  const effectTime = item.startTime + pft;

  // Find nearest position
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

export default function ScriptWindow() {
  const {
    timelineItems, positions, selectedTimelineItemId,
    selectTimelineItem, removeTimelineItem, updateTimelineItem,
    combineAsChain, breakChain,
  } = useProjectStore();

  const [sortField, setSortField] = useState<SortField>('eventTime');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterText, setFilterText] = useState('');
  const [collapsedChains, setCollapsedChains] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Build script rows
  const rows = useMemo(() => {
    const computed = timelineItems
      .map((item) => computeScriptRow(item, positions))
      .filter(Boolean) as NonNullable<ReturnType<typeof computeScriptRow>>[];

    // Filter
    const filtered = filterText
      ? computed.filter((r) =>
          r.description.toLowerCase().includes(filterText.toLowerCase()) ||
          r.position.toLowerCase().includes(filterText.toLowerCase()) ||
          r.notes.toLowerCase().includes(filterText.toLowerCase())
        )
      : computed;

    // Sort
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

  // Group by chain for collapse
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
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
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
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Table className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Script</h2>
        <div className="flex items-center gap-3 text-[9px] font-mono-code text-muted-foreground">
          <span>🎆 {pyroCount}</span>
          <span>🤖 {droneCount}</span>
          <span>🔗 {chainCount}</span>
          <span className="text-safety">${totalCost.toFixed(0)}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-2 py-1.5 border-b border-border flex items-center gap-1">
        <div className="relative flex-1">
          <Filter className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Filter..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="h-6 text-[10px] pl-6 bg-surface-2 border-border"
          />
        </div>
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          title="Combine as Chain (Ctrl+click to multi-select)"
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
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[9px] font-mono-code border-collapse min-w-[600px]">
          <thead className="sticky top-0 bg-surface-1 z-10">
            <tr className="border-b border-border">
              <th className="px-1 py-1 w-5"></th>
              <SortableHeader label="Event Time" field="eventTime" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Effect Time" field="effectTime" current={sortField} dir={sortDir} onSort={toggleSort} />
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">PFT</th>
              <SortableHeader label="Description" field="description" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Position" field="position" current={sortField} dir={sortDir} onSort={toggleSort} />
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">Pan°</th>
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">Tilt°</th>
              <SortableHeader label="Duration" field="duration" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Cost" field="cost" current={sortField} dir={sortDir} onSort={toggleSort} />
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">Chain</th>
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">X</th>
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">Y</th>
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">Z</th>
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">Notes</th>
              <th className="px-1 py-1 w-6"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ row, isChainHead, chainCount, collapsed }) => {
              const isSelected = selectedTimelineItemId === row.id || selectedIds.has(row.id);
              const chainColor = row.chainRef
                ? `hsl(${hashCode(row.chainRef) % 360}, 70%, 50%)`
                : undefined;

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/20 cursor-pointer transition-colors",
                    isSelected ? "bg-primary/10" : "hover:bg-surface-2/30",
                    row.chainRef && "border-l-2",
                  )}
                  style={row.chainRef ? { borderLeftColor: chainColor } : undefined}
                  onClick={(e) => toggleSelect(row.id, e)}
                >
                  {/* Chain collapse toggle */}
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

                  {/* Event Time */}
                  <td className="px-1 py-0.5">
                    <input
                      type="number" step="0.001" min="0"
                      className="w-16 bg-transparent border-b border-border/30 text-foreground focus:border-primary outline-none"
                      value={row.eventTime}
                      onChange={(e) => updateTimelineItem(row.id, { startTime: parseFloat(e.target.value) || 0 })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>

                  {/* Effect Time */}
                  <td className="px-1 py-0.5 text-electric">
                    {formatTime(row.effectTime)}
                  </td>

                  {/* Prefire */}
                  <td className="px-1 py-0.5">
                    {row.prefire > 0 ? (
                      <span className="text-warning">{row.prefire.toFixed(1)}s</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* Description */}
                  <td className="px-1 py-0.5">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                      <span className="text-foreground truncate max-w-[100px]">
                        {row.description}
                        {collapsed && chainCount > 1 && (
                          <span className="text-muted-foreground ml-1">×{chainCount}</span>
                        )}
                      </span>
                    </div>
                  </td>

                  {/* Position */}
                  <td className="px-1 py-0.5 text-muted-foreground truncate max-w-[60px]">{row.position}</td>

                  {/* Pan */}
                  <td className="px-1 py-0.5">
                    <input
                      type="number" step="1"
                      className="w-8 bg-transparent border-b border-border/30 text-muted-foreground focus:border-primary outline-none"
                      value={row.pan}
                      onChange={(e) => updateTimelineItem(row.id, { pan: parseFloat(e.target.value) || 0 })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>

                  {/* Tilt */}
                  <td className="px-1 py-0.5">
                    <input
                      type="number" step="1"
                      className="w-8 bg-transparent border-b border-border/30 text-muted-foreground focus:border-primary outline-none"
                      value={row.tilt}
                      onChange={(e) => updateTimelineItem(row.id, { tilt: parseFloat(e.target.value) || 0 })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>

                  {/* Duration */}
                  <td className="px-1 py-0.5 text-muted-foreground">{row.duration}s</td>

                  {/* Cost */}
                  <td className="px-1 py-0.5 text-safety">${row.cost}</td>

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
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>

                  {/* X Y Z */}
                  <td className="px-1 py-0.5 text-destructive">{row.x.toFixed(1)}</td>
                  <td className="px-1 py-0.5 text-success">{row.y.toFixed(1)}</td>
                  <td className="px-1 py-0.5 text-electric">{row.z.toFixed(1)}</td>

                  {/* Notes */}
                  <td className="px-1 py-0.5">
                    <input
                      className="w-full bg-transparent border-b border-border/20 text-muted-foreground focus:border-primary outline-none text-[8px]"
                      placeholder="..."
                      value={row.notes}
                      onChange={(e) => updateTimelineItem(row.id, { notes: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>

                  {/* Delete */}
                  <td className="px-0.5 py-0.5 text-center">
                    <button
                      className="text-destructive/30 hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); removeTimelineItem(row.id); }}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="px-3 py-8 text-center">
            <Table className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground/60">
              Drag effects to the timeline to see script rows here
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
