/**
 * DMXMonitorPanel — 512-Channel DMX Signal Monitor & Command Logger
 * Real-time DMX values visualization + protocol packet log
 * BR2049 terminal diagnostic aesthetic + persistence via dmx_logs table
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Activity, Trash2, Download, Filter, Radio, Save, History, ToggleLeft, ToggleRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useSfxChannelStore } from '@/store/useSfxChannelStore';
import { useProjectStore } from '@/store/useProjectStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DMXPacketLog {
  id: string;
  timestamp: number;
  source: string;
  protocol: string;
  universe: number;
  channels: { ch: number; prev: number; next: number }[];
}

const UNIVERSES = Array.from({ length: 16 }, (_, i) => i);
const SOURCES = ['All', 'Art-Net', 'sACN', 'Internal'] as const;

function ChannelGrid({ values, highlight }: { values: number[]; highlight?: Set<number> }) {
  return (
    <div className="grid gap-[1px]" style={{ gridTemplateColumns: 'repeat(32, 1fr)' }}>
      {values.map((v, i) => {
        const intensity = v / 255;
        const isHighlighted = highlight?.has(i);
        return (
          <div
            key={i}
            className={cn(
              "aspect-square flex items-center justify-center text-[5px] font-mono transition-colors relative",
              isHighlighted && "ring-1 ring-amber-400/50"
            )}
            style={{
              backgroundColor: intensity > 0
                ? `hsl(32 ${70 + intensity * 30}% ${5 + intensity * 55}%)`
                : 'hsl(220 10% 6%)',
              color: intensity > 0.5 ? 'hsl(220 10% 5%)' : 'hsl(220 10% 30%)',
            }}
            title={`CH ${i + 1}: ${v}`}
          >
            {v > 0 ? v : ''}
          </div>
        );
      })}
    </div>
  );
}

export default function DMXMonitorPanel({ fs = false }: { fs?: boolean }) {
  const channels = useSfxChannelStore(s => s.channels);
  const [universe, setUniverse] = useState(0);
  const [source, setSource] = useState<typeof SOURCES[number]>('All');
  const [packetLog, setPacketLog] = useState<DMXPacketLog[]>([]);
  const [dmxValues, setDmxValues] = useState<number[]>(new Array(512).fill(0));
  const [pps, setPps] = useState(0);
  const [filterChannel, setFilterChannel] = useState('');
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem('dmx-autosave') === 'true');
  const [saving, setSaving] = useState(false);
  const packetCountRef = useRef(0);
  const changedChannels = useRef(new Set<number>());
  const sessionId = useRef(`ses-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const autoSaveCountRef = useRef(0);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist autoSave toggle
  useEffect(() => {
    localStorage.setItem('dmx-autosave', autoSave ? 'true' : 'false');
  }, [autoSave]);

  // Simulate DMX values from channel store
  useEffect(() => {
    const newValues = new Array(512).fill(0);
    const changed: { ch: number; prev: number; next: number }[] = [];

    channels.forEach(ch => {
      if (ch.dmxUniverse === universe || universe === 0) {
        const addr = ch.dmxAddress - 1;
        const val = ch.firing ? ch.intensity : 0;
        for (let i = 0; i < ch.dmxChannels && addr + i < 512; i++) {
          const prev = dmxValues[addr + i] || 0;
          const next = val;
          if (prev !== next) {
            changed.push({ ch: addr + i + 1, prev, next });
            changedChannels.current.add(addr + i);
          }
          newValues[addr + i] = next;
        }
      }
    });

    if (changed.length > 0) {
      packetCountRef.current++;
      autoSaveCountRef.current++;
      setPacketLog(prev => [{
        id: `pkt-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        source: '192.168.1.100',
        protocol: 'Art-Net',
        universe,
        channels: changed,
      }, ...prev].slice(0, 200));

      setTimeout(() => changedChannels.current.clear(), 500);
    }

    setDmxValues(newValues);
  }, [channels, universe]);

  // PPS counter
  useEffect(() => {
    const iv = setInterval(() => {
      setPps(packetCountRef.current);
      packetCountRef.current = 0;
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Auto-save: every 100 packets or 30s
  useEffect(() => {
    if (!autoSave) return;
    const iv = setInterval(() => {
      if (autoSaveCountRef.current > 0 && packetLog.length > 0) {
        saveLog();
        autoSaveCountRef.current = 0;
      }
    }, 30000);
    return () => clearInterval(iv);
  }, [autoSave, packetLog]);

  useEffect(() => {
    if (autoSave && autoSaveCountRef.current >= 100) {
      saveLog();
      autoSaveCountRef.current = 0;
    }
  }, [packetLog, autoSave]);

  const saveLog = useCallback(async () => {
    const projectId = useProjectStore.getState().projectId;
    if (!projectId || packetLog.length === 0) return;
    setSaving(true);
    try {
      const rows = packetLog.slice(0, 100).map(p => ({
        project_id: projectId,
        session_id: sessionId.current,
        timestamp: new Date(p.timestamp).toISOString(),
        source: p.source,
        protocol: p.protocol,
        universe: p.universe,
        channel_data: p.channels,
      }));
      const { error } = await supabase.from('dmx_logs').insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} log entries saved`);
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }, [packetLog]);

  const loadHistory = useCallback(async () => {
    const projectId = useProjectStore.getState().projectId;
    if (!projectId) return;
    try {
      const { data, error } = await supabase
        .from('dmx_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: false })
        .limit(200);
      if (error) throw error;
      if (data && data.length > 0) {
        const loaded: DMXPacketLog[] = data.map((d: any) => ({
          id: d.id,
          timestamp: new Date(d.timestamp).getTime(),
          source: d.source,
          protocol: d.protocol,
          universe: d.universe,
          channels: d.channel_data as any,
        }));
        setPacketLog(prev => [...loaded, ...prev].slice(0, 400));
        toast.success(`${data.length} history entries loaded`);
      } else {
        toast.info('No history found');
      }
    } catch (e: any) {
      toast.error(`Load failed: ${e.message}`);
    }
  }, []);

  const clearLog = useCallback(() => setPacketLog([]), []);

  const exportCsv = useCallback(() => {
    const header = 'Timestamp,Source,Protocol,Universe,Channel,Previous,New\n';
    const rows = packetLog.flatMap(p =>
      p.channels.map(c =>
        `${new Date(p.timestamp).toISOString()},${p.source},${p.protocol},${p.universe},${c.ch},${c.prev},${c.next}`
      )
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dmx-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [packetLog]);

  const filteredLog = filterChannel
    ? packetLog.filter(p => p.channels.some(c => String(c.ch).includes(filterChannel)))
    : packetLog;

  return (
    <div className="flex flex-col h-full" style={{ background: 'hsl(220 15% 4%)' }}>
      {/* Header */}
      <div
        className="shrink-0 px-4 py-2.5 border-b flex items-center justify-between"
        style={{ borderColor: 'hsl(120 70% 42% / 0.1)', background: 'hsl(220 12% 5%)' }}
      >
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4" style={{ color: 'hsl(120 70% 50%)' }} />
          <span className="text-[10px] font-black font-mono tracking-[0.25em] text-foreground/80">DMX MONITOR</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Radio className="w-3 h-3" style={{ color: 'hsl(120 70% 50%)' }} />
            <span className="text-[8px] font-mono font-bold" style={{ color: 'hsl(120 70% 50%)' }}>{pps} pkt/s</span>
          </div>
          <span className="text-[7px] font-mono text-muted-foreground/30">{packetLog.length} logged</span>
        </div>
      </div>

      {/* Controls */}
      <div
        className="shrink-0 px-3 py-2 flex items-center gap-2 border-b flex-wrap"
        style={{ borderColor: 'hsl(120 70% 42% / 0.06)', background: 'hsl(220 10% 5%)' }}
      >
        <div className="flex items-center gap-1">
          <span className="text-[7px] font-mono text-muted-foreground/30">UNI</span>
          <select
            value={universe}
            onChange={e => setUniverse(Number(e.target.value))}
            className="bg-[hsl(220_10%_8%)] border border-border/15 rounded text-[9px] font-mono px-1.5 py-0.5 text-foreground/60"
          >
            {UNIVERSES.map(u => (
              <option key={u} value={u}>Universe {u}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-[2px]">
          {SOURCES.map(s => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={cn(
                "text-[7px] font-mono font-bold px-2 py-0.5 rounded transition-all tracking-wider",
                source === s
                  ? "bg-[hsl(120_70%_42%_/_0.15)] text-[hsl(120_70%_50%)]"
                  : "text-muted-foreground/30 hover:text-muted-foreground/50"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Auto-save toggle */}
        <button
          onClick={() => setAutoSave(!autoSave)}
          className={cn("flex items-center gap-1 text-[7px] font-mono font-bold px-2 py-0.5 rounded transition-all",
            autoSave ? "text-amber-400" : "text-muted-foreground/30"
          )}
        >
          {autoSave ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
          AUTO
        </button>

        <Button variant="ghost" size="sm" onClick={saveLog} disabled={saving || packetLog.length === 0} className="h-5 px-2 text-[7px] font-mono text-muted-foreground/40">
          <Save className="w-3 h-3 mr-1" />{saving ? '...' : 'SAVE'}
        </Button>
        <Button variant="ghost" size="sm" onClick={loadHistory} className="h-5 px-2 text-[7px] font-mono text-muted-foreground/40">
          <History className="w-3 h-3 mr-1" />HISTORY
        </Button>
        <Button variant="ghost" size="sm" onClick={clearLog} className="h-5 px-2 text-[7px] font-mono text-muted-foreground/40">
          <Trash2 className="w-3 h-3 mr-1" />CLEAR
        </Button>
        <Button variant="ghost" size="sm" onClick={exportCsv} className="h-5 px-2 text-[7px] font-mono text-muted-foreground/40">
          <Download className="w-3 h-3 mr-1" />CSV
        </Button>
      </div>

      {/* 512 Channel Grid */}
      <div className="shrink-0 px-3 py-2 border-b" style={{ borderColor: 'hsl(120 70% 42% / 0.06)' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[7px] font-mono text-muted-foreground/30 tracking-wider">512 CHANNELS · UNIVERSE {universe}</span>
          <span className="text-[7px] font-mono text-muted-foreground/20">
            {dmxValues.filter(v => v > 0).length} active
          </span>
        </div>
        <ChannelGrid values={dmxValues} highlight={changedChannels.current} />
        <div className="flex justify-between mt-0.5 px-[1px]">
          {[1, 64, 128, 192, 256, 320, 384, 448, 512].map(n => (
            <span key={n} className="text-[5px] font-mono text-muted-foreground/20">{n}</span>
          ))}
        </div>
      </div>

      {/* Packet Log */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          className="shrink-0 px-3 py-1.5 flex items-center justify-between border-b"
          style={{ borderColor: 'hsl(120 70% 42% / 0.06)', background: 'hsl(220 10% 5%)' }}
        >
          <span className="text-[7px] font-mono font-bold tracking-[0.2em] text-muted-foreground/40">SIGNAL LOG</span>
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-muted-foreground/25" />
            <input
              value={filterChannel}
              onChange={e => setFilterChannel(e.target.value)}
              placeholder="CH#"
              className="w-12 bg-transparent border-b border-border/15 text-[8px] font-mono text-foreground/50 outline-none placeholder:text-muted-foreground/20"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-3 py-1 space-y-[1px]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {filteredLog.length === 0 ? (
              <div className="text-[8px] text-muted-foreground/15 text-center py-8">
                AWAITING DMX SIGNAL...
              </div>
            ) : (
              filteredLog.map(pkt => (
                <div key={pkt.id} className="flex items-start gap-2 py-0.5 border-b border-border/5">
                  <span className="text-[6px] text-muted-foreground/20 shrink-0 w-16">
                    {new Date(pkt.timestamp).toLocaleTimeString('en', { hour12: false })}
                    .{String(pkt.timestamp % 1000).padStart(3, '0')}
                  </span>
                  <span className="text-[6px] shrink-0 w-20 text-muted-foreground/30">{pkt.source}</span>
                  <span className="text-[6px] shrink-0 w-10" style={{ color: 'hsl(120 70% 50% / 0.5)' }}>{pkt.protocol}</span>
                  <span className="text-[6px] shrink-0 w-6 text-muted-foreground/25">U{pkt.universe}</span>
                  <div className="flex-1 flex flex-wrap gap-x-2">
                    {pkt.channels.slice(0, 8).map((c, i) => (
                      <span key={i} className="text-[7px]">
                        <span className="text-muted-foreground/30">CH{c.ch}</span>
                        <span className="text-red-400/40 mx-0.5">{c.prev}</span>
                        <span className="text-muted-foreground/20">→</span>
                        <span style={{ color: 'hsl(32 100% 55%)' }}>{c.next}</span>
                      </span>
                    ))}
                    {pkt.channels.length > 8 && (
                      <span className="text-[6px] text-muted-foreground/20">+{pkt.channels.length - 8}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
