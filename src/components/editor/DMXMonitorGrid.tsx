import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Monitor, Grid3x3, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DMXUniverse } from '@/lib/dmxEngine';

interface DMXMonitorGridProps {
  universes: DMXUniverse[];
  className?: string;
}

/**
 * Visual DMX 512-channel monitor grid, inspired by ArtNetominator.
 * Displays all 512 channels as a color-coded grid with intensity values.
 */
export default function DMXMonitorGrid({ universes, className }: DMXMonitorGridProps) {
  const [selectedUniverse, setSelectedUniverse] = useState(0);
  const [viewMode, setViewMode] = useState<'compact' | 'expanded'>('compact');
  const [showValues, setShowValues] = useState(true);

  const universe = universes[selectedUniverse];
  const channels = universe?.channels ?? new Uint8Array(512);

  // Calculate stats
  const stats = useMemo(() => {
    let active = 0;
    let max = 0;
    let total = 0;
    for (let i = 0; i < 512; i++) {
      const v = channels[i];
      if (v > 0) active++;
      if (v > max) max = v;
      total += v;
    }
    return { active, max, avg: active > 0 ? Math.round(total / active) : 0 };
  }, [channels]);

  // Color mapping: value → background color (similar to ArtNetominator)
  const getChannelColor = (value: number): string => {
    if (value === 0) return 'bg-black/40';
    if (value < 32) return 'bg-blue-950/80';
    if (value < 64) return 'bg-blue-900/80';
    if (value < 96) return 'bg-cyan-900/80';
    if (value < 128) return 'bg-teal-800/80';
    if (value < 160) return 'bg-green-800/80';
    if (value < 192) return 'bg-yellow-700/80';
    if (value < 224) return 'bg-orange-700/80';
    return 'bg-red-700/80';
  };

  const getTextColor = (value: number): string => {
    if (value === 0) return 'text-muted-foreground/40';
    if (value < 128) return 'text-foreground/70';
    return 'text-foreground';
  };

  const cols = viewMode === 'compact' ? 32 : 16;
  const rows = Math.ceil(512 / cols);

  return (
    <div className={cn('bg-surface-1 border border-border rounded-md', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-surface-2 rounded-t-md">
        <div className="flex items-center gap-1.5">
          <Monitor className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-semibold text-foreground">DMX Monitor</span>
        </div>
        <div className="flex items-center gap-1">
          {universes.length > 1 && (
            <Select
              value={String(selectedUniverse)}
              onValueChange={(v) => setSelectedUniverse(Number(v))}
            >
              <SelectTrigger className="h-5 text-[8px] w-20 bg-surface-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {universes.map((u, i) => (
                  <SelectItem key={u.id} value={String(i)} className="text-[9px]">
                    Uni {u.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm" variant="ghost"
            className="h-5 w-5 p-0"
            onClick={() => setShowValues(!showValues)}
            title={showValues ? 'Ocultar valores' : 'Mostrar valores'}
          >
            <Grid3x3 className={cn('w-3 h-3', showValues ? 'text-primary' : 'text-muted-foreground')} />
          </Button>
          <Button
            size="sm" variant="ghost"
            className="h-5 w-5 p-0"
            onClick={() => setViewMode(viewMode === 'compact' ? 'expanded' : 'compact')}
            title={viewMode === 'compact' ? 'Expandir' : 'Compactar'}
          >
            {viewMode === 'compact'
              ? <Maximize2 className="w-3 h-3 text-muted-foreground" />
              : <Minimize2 className="w-3 h-3 text-primary" />
            }
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 px-2 py-1 border-b border-border/50 text-[8px] text-muted-foreground bg-surface-0/50">
        <span>Universe: <strong className="text-foreground">{universe?.id ?? '—'}</strong></span>
        <span>Active: <strong className="text-green-400">{stats.active}</strong>/512</span>
        <span>Max: <strong className="text-orange-400">{stats.max}</strong></span>
        <span>Avg: <strong className="text-cyan-400">{stats.avg}</strong></span>
        <span className="ml-auto">
          {universe?.fixtures.length ?? 0} fixtures
        </span>
      </div>

      {/* Channel row headers */}
      <div className="overflow-auto max-h-[400px] scrollbar-thin">
        <div className="p-1">
          {/* Column headers */}
          <div className="flex gap-px mb-px" style={{ paddingLeft: viewMode === 'expanded' ? 28 : 20 }}>
            {Array.from({ length: cols }, (_, i) => (
              <div
                key={i}
                className="text-[8px] text-muted-foreground/60 text-center font-mono"
                style={{ width: viewMode === 'compact' ? 14 : 28, minWidth: viewMode === 'compact' ? 14 : 28 }}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {Array.from({ length: rows }, (_, row) => {
            const startCh = row * cols + 1;
            return (
              <div key={row} className="flex gap-px items-center">
                {/* Row label */}
                <div
                  className="text-[8px] text-muted-foreground/60 font-mono text-right pr-1 shrink-0"
                  style={{ width: viewMode === 'expanded' ? 28 : 20 }}
                >
                  {startCh}
                </div>
                {/* Channel cells */}
                {Array.from({ length: cols }, (_, col) => {
                  const ch = row * cols + col;
                  if (ch >= 512) return <div key={col} style={{ width: viewMode === 'compact' ? 14 : 28 }} />;
                  const value = channels[ch];
                  return (
                    <div
                      key={col}
                      className={cn(
                        'rounded-[2px] flex items-center justify-center transition-colors duration-150',
                        getChannelColor(value),
                        getTextColor(value),
                        'border border-white/5',
                        value > 0 && 'ring-1 ring-inset ring-white/10',
                      )}
                      style={{
                        width: viewMode === 'compact' ? 14 : 28,
                        height: viewMode === 'compact' ? 12 : 20,
                        minWidth: viewMode === 'compact' ? 14 : 28,
                      }}
                      title={`Ch ${ch + 1}: ${value} (${Math.round(value / 2.55)}%)`}
                    >
                      {showValues && (
                        <span
                          className="font-mono leading-none"
                          style={{ fontSize: viewMode === 'compact' ? 6 : 8 }}
                        >
                          {value > 0 ? value : '·'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-1 px-2 py-1 border-t border-border/50 text-[8px] text-muted-foreground">
        <span>0</span>
        <div className="flex gap-px flex-1">
          {[0, 32, 64, 96, 128, 160, 192, 224].map(v => (
            <div
              key={v}
              className={cn('h-2 flex-1 rounded-[1px]', getChannelColor(v || 1))}
              title={`${v}`}
            />
          ))}
        </div>
        <span>255</span>
      </div>
    </div>
  );
}
