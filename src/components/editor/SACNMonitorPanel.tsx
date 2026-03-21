/**
 * SACNMonitorPanel — Real-time sACN/E1.31 Universe Monitor
 * 512-channel heat grid, activity sparkline, source info, hover inspector
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Activity, Layers, Eye, Grid3X3, BarChart3, RefreshCw, Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getSACNReceiver, type SACNUniverse } from '@/lib/sacnEngine';
import { getMappings } from '@/lib/sacnDmxBridge';
import { useSfxChannelStore } from '@/store/useSfxChannelStore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SACNMonitorPanelProps {
  compact?: boolean;
  onClose?: () => void;
}

type ViewMode = 'grid' | 'bars';

const HEAT_COLORS = [
  'hsl(220 10% 12%)',  // 0
  'hsl(220 50% 20%)',  // low
  'hsl(210 70% 35%)',  // med-low
  'hsl(195 80% 45%)',  // med
  'hsl(180 85% 50%)',  // med-high
  'hsl(60 90% 55%)',   // high
  'hsl(0 85% 60%)',    // max
];

function getHeatColor(val: number): string {
  if (val === 0) return HEAT_COLORS[0];
  const idx = Math.min(6, Math.floor((val / 255) * 6) + 1);
  return HEAT_COLORS[idx];
}

export default function SACNMonitorPanel({ compact = false, onClose }: SACNMonitorPanelProps) {
  const [universes, setUniverses] = useState<SACNUniverse[]>([]);
  const [selectedUniverse, setSelectedUniverse] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [hoveredChannel, setHoveredChannel] = useState<number | null>(null);
  const [activityHistory, setActivityHistory] = useState<number[]>(new Array(60).fill(0));
  const prevChannels = useRef<Uint8Array | number[]>(new Array(512).fill(0));
  const changeCount = useRef(0);
  const receiver = useRef(getSACNReceiver());
  const sfxChannels = useSfxChannelStore(s => s.channels);
  const mappings = useMemo(() => getMappings(), [universes]);

  // Poll sACN data at ~15fps
  useEffect(() => {
    const interval = setInterval(() => {
      const unis = receiver.current.subscribedUniverses.map(u => ({ ...u }));
      setUniverses(unis);

      // Count changes for activity graph
      const current = unis.find(u => u.universe === selectedUniverse);
      if (current) {
        let changes = 0;
        for (let i = 0; i < 512; i++) {
          if ((current.channels[i] || 0) !== (prevChannels.current[i] || 0)) changes++;
        }
        changeCount.current += changes;
        prevChannels.current = [...current.channels];
      }
    }, 66);
    return () => clearInterval(interval);
  }, [selectedUniverse]);

  // Activity sparkline — 1 sample/sec
  useEffect(() => {
    const interval = setInterval(() => {
      setActivityHistory(prev => {
        const next = [...prev.slice(1), changeCount.current];
        changeCount.current = 0;
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentUniverse = universes.find(u => u.universe === selectedUniverse);
  const channels = currentUniverse?.channels || new Array(512).fill(0);
  const activeCount = channels.filter((v: number) => v > 0).length;
  const maxActivity = Math.max(1, ...activityHistory);

  const getMappedName = useCallback((chIdx: number) => {
    const m = mappings.find(m => m.universe === selectedUniverse && m.startChannel === chIdx + 1);
    if (!m) return null;
    const sfx = sfxChannels.find(c => c.id === m.sfxChannelId);
    return sfx?.name || m.sfxChannelId;
  }, [mappings, selectedUniverse, sfxChannels]);

  return (
    <div className="flex flex-col h-full gap-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-primary/70" />
          <span className={cn("font-bold uppercase tracking-wider text-foreground", compact ? "text-[9px]" : "text-[10px]")}>
            sACN Monitor
          </span>
          {currentUniverse && (
            <Badge variant="outline" className="text-[7px] h-4 px-1 text-emerald-400 border-emerald-500/30">
              {currentUniverse.fps}fps
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Universe selector */}
          <Select value={String(selectedUniverse)} onValueChange={v => setSelectedUniverse(parseInt(v))}>
            <SelectTrigger className="h-5 w-20 text-[8px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {universes.length > 0
                ? universes.map(u => (
                    <SelectItem key={u.universe} value={String(u.universe)} className="text-[9px]">
                      Universe {u.universe}
                    </SelectItem>
                  ))
                : <SelectItem value="1" className="text-[9px]">Universe 1</SelectItem>
              }
            </SelectContent>
          </Select>
          {/* View toggle */}
          <Button size="sm" variant="ghost" className="h-5 w-5 p-0"
            onClick={() => setViewMode(m => m === 'grid' ? 'bars' : 'grid')}>
            {viewMode === 'grid' ? <BarChart3 className="w-3 h-3" /> : <Grid3X3 className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Source info */}
      {currentUniverse && (
        <div className="flex items-center gap-2 text-[7px] text-muted-foreground/50 px-0.5">
          <span>Source: <span className="text-foreground/60">{currentUniverse.sourceName || '—'}</span></span>
          <span>Pri: <span className="text-foreground/60">{currentUniverse.priority}</span></span>
          <span>Seq: <span className="text-foreground/60">{currentUniverse.sequence}</span></span>
          <span className="ml-auto">{activeCount}/512 active</span>
        </div>
      )}

      {/* Activity Sparkline */}
      <div className="h-6 flex items-end gap-px px-0.5 rounded bg-background/20 border border-border/10">
        {activityHistory.map((val, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-150"
            style={{
              height: `${Math.max(2, (val / maxActivity) * 100)}%`,
              backgroundColor: val > 0 ? 'hsl(var(--primary) / 0.6)' : 'hsl(220 10% 18%)',
            }}
          />
        ))}
      </div>
      <div className="text-[6px] text-muted-foreground/30 text-right">▲ ch changes/sec (60s)</div>

      {/* Main view */}
      <ScrollArea className="flex-1">
        {!currentUniverse ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/30">
            <Layers className="w-6 h-6 mb-1" />
            <p className="text-[9px]">No sACN data — subscribe to a universe</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* ── 512-Channel Heat Grid (32×16) ── */
          <TooltipProvider delayDuration={0}>
            <div className="grid gap-[1px]" style={{ gridTemplateColumns: 'repeat(32, 1fr)' }}>
              {Array.from({ length: 512 }, (_, i) => {
                const val = channels[i] || 0;
                const mapped = getMappedName(i);
                return (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "aspect-square rounded-[1px] cursor-crosshair transition-colors duration-100",
                          hoveredChannel === i && "ring-1 ring-foreground/40"
                        )}
                        style={{ backgroundColor: getHeatColor(val) }}
                        onMouseEnter={() => setHoveredChannel(i)}
                        onMouseLeave={() => setHoveredChannel(null)}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[9px] p-1.5 space-y-0.5">
                      <div className="font-bold">Ch {i + 1}</div>
                      <div>DMX: {val} ({Math.round(val / 2.55)}%)</div>
                      {mapped && <div className="text-primary/80">→ {mapped}</div>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        ) : (
          /* ── Bar Chart View (64 channels) ── */
          <div className="space-y-[2px] px-0.5">
            {Array.from({ length: 64 }, (_, i) => {
              const val = channels[i] || 0;
              const mapped = getMappedName(i);
              return (
                <div key={i} className="flex items-center gap-1 h-3">
                  <span className="text-[6px] font-mono text-muted-foreground/40 w-5 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 h-full rounded-sm overflow-hidden" style={{ background: 'hsl(220 10% 12%)' }}>
                    <div
                      className="h-full rounded-sm transition-all duration-100"
                      style={{
                        width: `${(val / 255) * 100}%`,
                        backgroundColor: getHeatColor(val),
                      }}
                    />
                  </div>
                  <span className="text-[6px] font-mono text-foreground/40 w-6 text-right shrink-0">{val}</span>
                  {mapped && <span className="text-[6px] text-primary/50 truncate max-w-12">{mapped}</span>}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Legend */}
      <div className="flex items-center gap-1 px-0.5">
        <span className="text-[6px] text-muted-foreground/30">0</span>
        <div className="flex-1 flex gap-px h-2">
          {HEAT_COLORS.map((c, i) => (
            <div key={i} className="flex-1 rounded-[1px]" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span className="text-[6px] text-muted-foreground/30">255</span>
      </div>
    </div>
  );
}
