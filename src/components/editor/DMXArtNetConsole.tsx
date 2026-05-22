/**
 * DMXArtNetConsole — Protocol monitor for Art-Net / DMX universes.
 * Consumes data from ShowPlan via ArtNetPatchExporter.
 * Gated by VerificationEngine.
 */
import { useState, useCallback } from 'react';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { generateArtNetPatchCSV, downloadArtNetPatch } from '@/core/export/ArtNetPatchExporter';
import { useVerificationEngine } from '@/core/verification/useVerificationEngine';
import { artNetBridge } from '@/core/protocols/ArtNetBridge';
import { linkFailoverPolicy } from '@/core/protocols/LinkFailoverPolicy';
import { cn } from '@/lib/utils';
import { Radio, RefreshCw, Wifi, WifiOff, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function DMXArtNetConsole() {
  const [, setTick] = useState(0);
  const [preview, setPreview] = useState('');
  const [cueCount, setCueCount] = useState(0);
  const [exportErrors, setExportErrors] = useState<string[]>([]);
  const { level } = useVerificationEngine();
  const canExport = level === 'READY_FOR_EXPORT' || level === 'READY_FOR_FIELD';
  const refresh = useCallback(() => setTick(t => t + 1), []);

  const sp = showPlanManager.current;
  const artnetState = artNetBridge.getState();
  const isConnected = artnetState === 'connected';
  const artnetStats = artNetBridge.getStats();
  const failover = linkFailoverPolicy.getStatus();

  const universeMap = new Map<number, { channels: Set<number>; cues: number }>();
  for (const cue of sp.dmxCues) {
    const entry = universeMap.get(cue.universe) ?? { channels: new Set<number>(), cues: 0 };
    entry.channels.add(cue.channel);
    entry.cues += 1;
    universeMap.set(cue.universe, entry);
  }
  const universeSummary = Array.from(universeMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([id, data]) => ({ id, channelCount: data.channels.size, cueCount: data.cues }));

  const handlePreview = useCallback(() => {
    const result = generateArtNetPatchCSV();
    setPreview(result.csv);
    setCueCount(result.cueCount);
    setExportErrors(result.errors);
  }, []);

  const handleExport = useCallback(() => {
    downloadArtNetPatch();
  }, []);

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">DMX / Art-Net Console</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border',
            canExport ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
            'bg-red-500/15 text-red-400 border-red-500/30'
          )}>
            {level.replace(/_/g, ' ')}
          </span>
          <div className={cn(
            'flex items-center gap-1 text-[8px] font-mono px-2 py-0.5 rounded border',
            isConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
          )}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </div>
          <Button size="sm" variant="outline" onClick={refresh} className="h-6 text-[9px] font-mono gap-1">
            <RefreshCw className="w-3 h-3" /> REFRESH
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground">
        <span>DMX Cues: <span className="text-foreground">{sp.dmxCues.length}</span></span>
        <span>Universes: <span className="text-foreground">{universeSummary.length}</span></span>
        <span>Failover: <span className="text-foreground">{failover.activeLink}</span> ({failover.failoverCount} switches)</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="border border-border/10 rounded p-3 space-y-1">
          <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest">ART-NET</span>
          <div className="text-[9px] font-mono space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">State</span><span className="text-foreground/70">{artnetState}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Nodes</span><span className="text-foreground/70">{artnetStats.nodes}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TX/RX</span><span className="text-foreground/70">{artnetStats.sent}/{artnetStats.received}</span></div>
          </div>
        </div>
        <div className="border border-border/10 rounded p-3 space-y-1">
          <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest">SHOWPLAN DMX</span>
          <div className="text-[9px] font-mono space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Cues</span><span className="text-foreground/70">{sp.dmxCues.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Universes</span><span className="text-foreground/70">{universeSummary.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Ch</span><span className="text-foreground/70">{universeSummary.reduce((s, u) => s + u.channelCount, 0)}</span></div>
          </div>
        </div>
        <div className="border border-border/10 rounded p-3 space-y-1">
          <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest">FAILOVER</span>
          <div className="text-[9px] font-mono space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Active</span><span className="text-foreground/70">{failover.activeLink}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Switches</span><span className="text-foreground/70">{failover.failoverCount}</span></div>
          </div>
        </div>
      </div>

      <div className="border border-border/10 rounded p-2 space-y-1">
        <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest">UNIVERSE MAP (SHOWPLAN)</span>
        {universeSummary.length === 0 ? (
          <p className="text-[9px] font-mono text-muted-foreground/40 mt-1">No DMX cues in ShowPlan</p>
        ) : (
          <div className="mt-1 space-y-1">
            {universeSummary.map(u => (
              <div key={u.id} className="flex items-center gap-3 text-[9px] font-mono">
                <span className="text-blue-400/70 w-12">U{u.id}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                  <div className="h-full bg-blue-400/40 rounded-full" style={{ width: `${(u.channelCount / 512) * 100}%` }} />
                </div>
                <span className="text-muted-foreground/50 w-20 text-right">{u.channelCount}ch / {u.cueCount} cues</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {exportErrors.length > 0 && (
        <div className="border border-red-500/20 rounded p-2 bg-red-500/5 space-y-0.5 max-h-20 overflow-y-auto">
          {exportErrors.map((e, i) => (
            <div key={i} className="text-[8px] font-mono text-red-400 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {e}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handlePreview} className="h-6 text-[9px] font-mono gap-1">
          <RefreshCw className="w-3 h-3" /> PREVIEW CSV
        </Button>
        <Button size="sm" onClick={handleExport} disabled={!canExport || sp.dmxCues.length === 0}
          className="h-6 text-[9px] font-mono gap-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-30">
          <Download className="w-3 h-3" /> EXPORT PATCH
        </Button>
        {cueCount > 0 && <span className="text-[8px] font-mono text-muted-foreground">{cueCount} cues in patch</span>}
      </div>

      <ScrollArea className="flex-1 border border-border/10 rounded">
        <pre className="p-3 text-[9px] font-mono text-muted-foreground whitespace-pre leading-relaxed">
          {preview || '; Click PREVIEW CSV to generate Art-Net patch from ShowPlan'}
        </pre>
      </ScrollArea>
    </div>
  );
}
