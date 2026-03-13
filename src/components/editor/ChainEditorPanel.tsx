import { useState, useMemo, useCallback } from 'react';
import { Link2, Unlink, X, ChevronDown, ChevronRight, Zap, Clock, Play, Trash2, Plus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useProjectStore, EFFECT_LIBRARY, type TimelineItem } from '@/store/useProjectStore';
import { getChainStats, getUniqueChains } from '@/lib/chainEngine';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 55%)`;
}

export default function ChainEditorPanel({ onClose }: { onClose: () => void }) {
  const { timelineItems, selectedTimelineItemIds, selectedTimelineItemId, combineAsChain, breakChain, updateTimelineItem, selectTimelineItem } = useProjectStore();
  const [gapMs, setGapMs] = useState(200);
  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  const [autoSpaceMode, setAutoSpaceMode] = useState<'equal' | 'accelerando' | 'ritardando'>('equal');

  const chains = useMemo(() => {
    const refs = getUniqueChains(timelineItems);
    return refs.map(ref => {
      const stats = getChainStats(timelineItems, ref);
      const items = timelineItems
        .filter(i => i.chainRef === ref)
        .sort((a, b) => a.startTime - b.startTime);
      return { ref, stats, items };
    }).filter(c => c.stats);
  }, [timelineItems]);

  const handleCreateChain = useCallback(() => {
    const ids = selectedTimelineItemIds.length > 0
      ? selectedTimelineItemIds
      : selectedTimelineItemId ? [selectedTimelineItemId] : [];
    
    if (ids.length < 2) {
      toast.warning('Selecione pelo menos 2 cues no Script para criar uma cadeia', { icon: '🔗' });
      return;
    }

    combineAsChain(ids, gapMs);
    toast.success(`Cadeia criada com ${ids.length} cues · gap ${gapMs}ms`, { icon: '🔗' });
  }, [selectedTimelineItemIds, selectedTimelineItemId, gapMs, combineAsChain]);

  const handleAutoSpace = useCallback((chainRef: string) => {
    const items = timelineItems
      .filter(i => i.chainRef === chainRef)
      .sort((a, b) => a.startTime - b.startTime);
    
    if (items.length < 2) return;
    const startTime = items[0].startTime;
    const gapSec = gapMs / 1000;

    items.forEach((item, idx) => {
      let newTime: number;
      if (autoSpaceMode === 'equal') {
        newTime = startTime + idx * gapSec;
      } else if (autoSpaceMode === 'accelerando') {
        // Gaps get progressively shorter
        const factor = 1 - (idx / items.length) * 0.5;
        newTime = startTime + idx * gapSec * factor;
      } else {
        // Ritardando — gaps get progressively longer
        const factor = 1 + (idx / items.length) * 0.8;
        newTime = startTime + idx * gapSec * factor;
      }
      updateTimelineItem(item.id, { startTime: newTime, chainGap: gapMs });
    });

    toast.success(`Cadeia re-espaçada: ${autoSpaceMode} · ${gapMs}ms`, { icon: '⏱️' });
  }, [timelineItems, gapMs, autoSpaceMode, updateTimelineItem]);

  const handleBreakChain = useCallback((ref: string) => {
    breakChain(ref);
    toast.success('Cadeia desfeita', { icon: '🔓' });
  }, [breakChain]);

  const handleDeleteChain = useCallback((ref: string) => {
    const items = timelineItems.filter(i => i.chainRef === ref);
    const store = useProjectStore.getState();
    items.forEach(i => store.removeTimelineItem(i.id));
    toast.success(`${items.length} cues removidos`, { icon: '🗑️' });
  }, [timelineItems]);

  const selectedCount = selectedTimelineItemIds.length || (selectedTimelineItemId ? 1 : 0);

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Link2 className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-foreground uppercase tracking-wider flex-1">Chain Editor</span>
        <span className="text-[9px] text-muted-foreground font-mono">{chains.length} chains</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Create chain controls */}
      <div className="px-3 py-2 border-b border-border/50 space-y-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Create Chain</span>
          {selectedCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-bold ml-auto">
              {selectedCount} cues
            </span>
          )}
        </div>

        {/* Gap configuration */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Gap between shots</label>
            <span className="text-[10px] font-mono text-foreground">{gapMs}ms</span>
          </div>
          <Slider
            value={[gapMs]}
            onValueChange={([v]) => setGapMs(v)}
            min={20}
            max={2000}
            step={10}
            className="w-full"
          />
          <div className="flex gap-1">
            {[50, 100, 200, 500, 1000].map(ms => (
              <button
                key={ms}
                onClick={() => setGapMs(ms)}
                className={cn(
                  "flex-1 text-[8px] py-0.5 rounded-sm font-mono transition-colors",
                  gapMs === ms ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {ms}ms
              </button>
            ))}
          </div>
        </div>

        {/* Auto-space mode */}
        <div className="flex gap-1">
          {(['equal', 'accelerando', 'ritardando'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setAutoSpaceMode(mode)}
              className={cn(
                "flex-1 text-[8px] py-1 rounded-sm font-semibold uppercase tracking-wider transition-colors",
                autoSpaceMode === mode
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
              )}
            >
              {mode === 'equal' ? '═ Equal' : mode === 'accelerando' ? '▸ Accel' : '◂ Rit'}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          className="w-full h-7 text-[10px] gap-1.5"
          onClick={handleCreateChain}
          disabled={selectedCount < 2}
        >
          <Link2 className="w-3 h-3" />
          Create Chain ({selectedCount} cues · {gapMs}ms gap)
        </Button>
      </div>

      {/* Chain list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {chains.length === 0 ? (
            <div className="text-center py-8">
              <Link2 className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-[10px] text-muted-foreground">Nenhuma cadeia criada</p>
              <p className="text-[9px] text-muted-foreground mt-1">
                Selecione 2+ cues no Script e clique "Create Chain"
              </p>
            </div>
          ) : (
            chains.map(({ ref, stats, items }) => {
              const isExpanded = expandedChain === ref;
              const color = hashColor(ref);

              return (
                <div key={ref} className="border border-border/50 rounded-md overflow-hidden">
                  {/* Chain header */}
                  <button
                    onClick={() => setExpandedChain(isExpanded ? null : ref)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted/30 transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[10px] font-bold text-foreground flex-1 text-left truncate">
                      Chain {ref.slice(-5)}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {stats!.count} cues · {stats!.totalDuration.toFixed(2)}s
                    </span>
                    {stats!.avgGap > 0 && (
                      <span className="text-[8px] text-muted-foreground font-mono">
                        Δ{(stats!.avgGap * 1000).toFixed(0)}ms
                      </span>
                    )}
                  </button>

                  {/* Expanded: chain items */}
                  {isExpanded && (
                    <div className="border-t border-border/30 bg-muted/20">
                      <div className="px-2 py-1 space-y-0.5">
                        {items.map((item, idx) => {
                          const eff = EFFECT_LIBRARY.find(e => e.id === item.effectId);
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => selectTimelineItem(item.id)}
                            >
                              <span className="text-[8px] text-muted-foreground font-mono w-4">#{idx + 1}</span>
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: eff?.color || '#888' }} />
                              <span className="text-[9px] flex-1 truncate">{eff?.name || item.effectId}</span>
                              <span className="text-[9px] font-mono text-muted-foreground">{item.startTime.toFixed(3)}s</span>
                              {idx > 0 && (
                                <span className="text-[8px] font-mono text-primary">
                                  +{((item.startTime - items[idx - 1].startTime) * 1000).toFixed(0)}ms
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Chain actions */}
                      <div className="flex gap-1 px-2 py-1.5 border-t border-border/20">
                        <Button
                          variant="ghost" size="sm"
                          className="flex-1 h-6 text-[9px] gap-1"
                          onClick={() => handleAutoSpace(ref)}
                        >
                          <Clock className="w-2.5 h-2.5" /> Re-space ({gapMs}ms)
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="flex-1 h-6 text-[9px] gap-1"
                          onClick={() => handleBreakChain(ref)}
                        >
                          <Unlink className="w-2.5 h-2.5" /> Break
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-6 text-[9px] gap-1 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteChain(ref)}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer info */}
      <div className="px-3 py-2 border-t border-border/30 text-[9px] text-muted-foreground space-y-0.5">
        <p>Selecione cues no Script → Create Chain</p>
        <p>Re-space ajusta timing · Break desfaz a cadeia</p>
      </div>
    </div>
  );
}
