/**
 * Auto Fire Panel — Music-synced firing with timecode
 * Supports Full Auto, Semi-Auto (event-based GO), UltraFire mode, and Priority Disable
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Play, Square, RotateCcw, Music, Upload, Trash2, Download, Shield, ShieldOff, Zap, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useProjectStore } from '@/store/useProjectStore';
import type { AutoFireCue } from './types';
import { formatTimecode, FIRING_RULES } from './constants';
import { parseFireOneCSV, exportFireOneCSV, exportFlamesLauncherCSV, downloadFile, autoDetectAndParse } from '@/lib/fireoneScriptParser';
import { FIREONE_PRIORITY_GROUPS, FIREONE_FILE_SLOTS } from '@/lib/fireoneProtocol';

interface AutoFirePanelProps {
  fs: boolean;
  pyroArm: boolean;
  dmxArm: boolean;
  onFireCue?: (cue: AutoFireCue) => void;
  onPriorityToggle?: (priority: number, enabled: boolean) => void;
  priorities?: Map<number, boolean>;
  ultraFireMode?: boolean;
  onUltraFireToggle?: (enabled: boolean) => void;
}

export const DEMO_CUES: AutoFireCue[] = [
  { id: 'af-1', cueNumber: 1, device: 'dmx', name: 'SPARKULAR', state: 'ready', timecodeMs: 4858, addresses: '1:3:5:7', mode: 'ltr', effect: 'Height 10', duration: 5.5, prefire: 2.5, trigger: 0, triggerSource: 'manual', eventNumber: 1 },
  { id: 'af-2', cueNumber: 2, device: 'dmx', name: 'SPARKULAR JET', state: 'ready', timecodeMs: 57846, addresses: '13:15', mode: 'sync', effect: 'JET ON', duration: 1.0, prefire: 0, trigger: 0, triggerSource: 'manual', eventNumber: 1 },
  { id: 'af-3', cueNumber: 3, device: 'dmx', name: 'uFlamer 2CH', state: 'ready', timecodeMs: 57854, addresses: '21:23:25:27', mode: 'sync', effect: 'JET', duration: 0.2, prefire: 0.2, trigger: 0, triggerSource: 'midi', eventNumber: 2 },
  { id: 'af-4', cueNumber: 4, device: 'dmx', name: 'uFlamer 2CH', state: 'ready', timecodeMs: 58781, addresses: '21:23:25:27', mode: 'sync', effect: 'JET', duration: 0.2, prefire: 0.2, trigger: 0, triggerSource: 'midi', eventNumber: 2 },
  { id: 'af-5', cueNumber: 5, device: 'dmx', name: 'uFlamer 2CH', state: 'ready', timecodeMs: 59707, addresses: '21:23:25:27', mode: 'sync', effect: 'JET', duration: 0.2, prefire: 0.2, trigger: 0, triggerSource: 'ltc', eventNumber: 3 },
  { id: 'af-6', cueNumber: 6, device: 'dmx', name: 'Circle Flamer', state: 'ready', timecodeMs: 60216, addresses: '29:35', mode: 'sync', effect: 'Wave 5→11', duration: 1.0, prefire: 0, trigger: 0, triggerSource: 'ltc', eventNumber: 3 },
  { id: 'af-7', cueNumber: 7, device: 'dmx', name: 'uFlamer 2CH', state: 'ready', timecodeMs: 60634, addresses: '21:23:25:27', mode: 'sync', effect: 'JET', duration: 0.2, prefire: 0.2, trigger: 0, triggerSource: 'manual' },
  { id: 'af-8', cueNumber: 8, device: 'dmx', name: 'uFlamer 2CH', state: 'ready', timecodeMs: 61547, addresses: '21:23:25:27', mode: 'sync', effect: 'JET', duration: 0.2, prefire: 0.2, trigger: 0, triggerSource: 'manual' },
  { id: 'af-9', cueNumber: 9, device: 'dmx', name: 'Circle Flamer', state: 'ready', timecodeMs: 63306, addresses: '29:35', mode: 'sync', effect: 'Wave 11→5', duration: 1.0, prefire: 0, trigger: 0, triggerSource: 'manual' },
  { id: 'af-10', cueNumber: 10, device: 'dmx', name: 'uFlamer 2CH', state: 'ready', timecodeMs: 65257, addresses: '21:23:25:27', mode: 'sync', effect: 'JET', duration: 0.2, prefire: 0.2, trigger: 0, triggerSource: 'manual' },
  { id: 'af-11', cueNumber: 11, device: 'dmx', name: 'Circle Flamer', state: 'ready', timecodeMs: 66668, addresses: '29:35', mode: 'sync', effect: 'BIG Wave 1→15', duration: 2.0, prefire: 0, trigger: 0, triggerSource: 'manual' },
  { id: 'af-12', cueNumber: 12, device: 'pyro', name: 'PYRO SHELL', state: 'ready', timecodeMs: 72000, addresses: '0:1', mode: 'ltr', effect: 'Burst', duration: 0.5, prefire: 1.0, trigger: 0, triggerSource: 'manual', priority: 1 },
];

type FireMode = 'auto' | 'semi-auto';

export default function AutoFirePanel({ fs, pyroArm, dmxArm, onFireCue, onPriorityToggle, priorities, ultraFireMode, onUltraFireToggle }: AutoFirePanelProps) {
  const { currentTime, isPlaying, setPlaying } = useProjectStore();
  const [cues, setCues] = useState<AutoFireCue[]>(DEMO_CUES);
  const [triggerSource, setTriggerSource] = useState<'manual' | 'midi' | 'ltc'>('manual');
  const [runTimeMs, setRunTimeMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [projectName, setProjectName] = useState('Autofire_proj');
  const [musicFile, setMusicFile] = useState('[W]TheFatRat-Xenogenesis');
  const [musicLengthMs] = useState(233379);
  const [dotLengthMs] = useState(96120);
  const [midiTimecode, setMidiTimecode] = useState('00:00:00:00');
  const [ltcTimecode, setLtcTimecode] = useState('00:00:00:00');
  const [timeOffset, setTimeOffset] = useState(0);
  const [fireMode, setFireMode] = useState<FireMode>('auto');
  const [currentEvent, setCurrentEvent] = useState(0);
  const [fileSlot, setFileSlot] = useState(1);
  const [verifyCode, setVerifyCode] = useState('');
  const runTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute event groups
  const eventGroups = useMemo(() => {
    const groups = new Map<number, AutoFireCue[]>();
    cues.forEach(c => {
      const ev = c.eventNumber ?? 0;
      if (!groups.has(ev)) groups.set(ev, []);
      groups.get(ev)!.push(c);
    });
    return groups;
  }, [cues]);

  const maxEvent = useMemo(() => {
    let max = 0;
    cues.forEach(c => { if ((c.eventNumber ?? 0) > max) max = c.eventNumber!; });
    return max;
  }, [cues]);

  // Multi-format import handler (FireOne CSV, FIR, SES, SCL, Flames)
  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { cues: parsed, source } = autoDetectAndParse(text, file.name);
      if (parsed.length === 0) {
        toast.error('No valid cues found in file');
        return;
      }
      setCues(parsed);
      toast.success(`Imported ${parsed.length} cues from ${source} (${file.name})`);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // FireOne CSV export
  const handleExportCSV = useCallback(() => {
    if (cues.length === 0) { toast.error('No cues to export'); return; }
    const csv = exportFireOneCSV(cues);
    downloadFile(csv, 'fireone_autofire.csv');
    toast.success(`Exported ${cues.length} cues to FireOne CSV`);
  }, [cues]);

  // Flames Launcher export
  const handleExportFlames = useCallback(() => {
    const dmxCues = cues.filter(c => c.device === 'dmx');
    if (dmxCues.length === 0) { toast.error('No DMX cues to export'); return; }
    const csv = exportFlamesLauncherCSV(dmxCues);
    downloadFile(csv, 'flames_launcher.csv');
    toast.success(`Exported ${dmxCues.length} DMX cues to Flames CSV`);
  }, [cues]);

  const handleReset = useCallback(() => {
    setRunTimeMs(0);
    setIsRunning(false);
    setCurrentEvent(0);
    if (runTimer.current) clearInterval(runTimer.current);
    setCues(prev => prev.map(c => ({ ...c, state: 'ready' as const })));
  }, []);

  const handleRun = useCallback(() => {
    if (!dmxArm && !pyroArm) return;
    if (isRunning) {
      setIsRunning(false);
      if (runTimer.current) clearInterval(runTimer.current);
      return;
    }
    setIsRunning(true);
    runTimer.current = setInterval(() => {
      setRunTimeMs(prev => {
        const next = prev + 100;
        setCues(cues => cues.map(c => {
          if (c.state === 'done') return c;
          // Skip disabled priorities
          if (c.priority && priorities && !priorities.get(c.priority)) return c;
          // Semi-auto: only fire cues in current event
          if (fireMode === 'semi-auto' && (c.eventNumber ?? 0) !== currentEvent && currentEvent > 0) return c;
          if (next >= c.timecodeMs + c.duration * 1000) return { ...c, state: 'done' as const };
          if (next >= c.timecodeMs - c.prefire * 1000) return { ...c, state: 'active' as const };
          if (next >= c.timecodeMs - 5000) return { ...c, state: 'queued' as const };
          return c;
        }));
        return next;
      });
    }, 100);
  }, [isRunning, dmxArm, pyroArm, fireMode, currentEvent, priorities]);

  // Semi-auto GO — advance to next event
  const handleSemiAutoGo = useCallback(() => {
    setCurrentEvent(prev => Math.min(prev + 1, maxEvent));
  }, [maxEvent]);

  useEffect(() => {
    return () => { if (runTimer.current) clearInterval(runTimer.current); };
  }, []);

  const progressPercent = dotLengthMs > 0 ? Math.min(100, (runTimeMs / dotLengthMs) * 100) : 0;

  const stateColor = (state: AutoFireCue['state']) => {
    switch (state) {
      case 'queued': return 'text-amber-400';
      case 'active': return 'text-red-400 font-bold';
      case 'done': return 'text-muted-foreground/30';
      default: return 'text-green-400/70';
    }
  };

  const triggerColor = (src: string) => {
    switch (src) {
      case 'midi': return 'text-purple-400';
      case 'ltc': return 'text-cyan-400';
      default: return 'text-muted-foreground/50';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Timecode bar */}
      <div className={cn(
        "border-b border-border/15 font-mono",
        fs ? "px-4 py-2 text-[9px]" : "px-2 py-1 text-[7px]"
      )} style={{ background: 'hsl(220 12% 7%)' }}>
        <div className="flex items-center gap-3 text-muted-foreground/40">
          <span>MID: <span className="text-purple-400/60">{midiTimecode}</span></span>
          <span>LTC: <span className="text-cyan-400/60">{ltcTimecode}</span></span>
          <span>DOT: <span className="text-foreground/60">{formatTimecode(runTimeMs)}</span> / {formatTimecode(dotLengthMs)}</span>
          <span>OffST: <span className="text-amber-400/60">{timeOffset}</span></span>
          <span>WAVE: {formatTimecode(runTimeMs)} / {formatTimecode(musicLengthMs)}</span>
        </div>
      </div>

      {/* Project + Mode + File Slot */}
      <div className={cn(
        "flex items-center gap-2 border-b border-border/15",
        fs ? "px-4 py-1.5" : "px-2 py-1"
      )} style={{ background: 'hsl(220 10% 8%)' }}>
        <span className={cn("font-bold text-foreground/60 truncate", fs ? "text-xs" : "text-[8px]")}>{projectName}</span>
        {/* Fire mode toggle */}
        <div className="flex items-center gap-0.5 ml-auto">
          {(['auto', 'semi-auto'] as const).map(mode => (
            <button key={mode} onClick={() => setFireMode(mode)}
              className={cn(
                "rounded font-bold uppercase transition-all border",
                fs ? "px-2 py-1 text-[8px]" : "px-1.5 py-0.5 text-[6px]",
                fireMode === mode
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-surface-2/30 border-border/10 text-muted-foreground/30'
              )}>
              {mode}
            </button>
          ))}
        </div>
        {/* File slot selector */}
        <div className="flex items-center gap-0.5">
          {Array.from({ length: FIREONE_FILE_SLOTS }, (_, i) => i + 1).map(slot => (
            <button key={slot} onClick={() => setFileSlot(slot)}
              className={cn(
                "rounded font-mono transition-all",
                fs ? "w-5 h-5 text-[8px]" : "w-4 h-4 text-[6px]",
                fileSlot === slot
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'bg-surface-2/20 text-muted-foreground/30 border border-border/5'
              )}>
              {slot}
            </button>
          ))}
        </div>
        {isRunning && <span className={cn("px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 font-bold animate-pulse", fs ? "text-[9px]" : "text-[7px]")}>LOCK</span>}
      </div>

      {/* UltraFire toggle + verify code */}
      <div className={cn(
        "flex items-center gap-2 border-b border-border/15",
        fs ? "px-4 py-1.5" : "px-2 py-1"
      )} style={{ background: 'hsl(220 10% 7%)' }}>
        <button onClick={() => onUltraFireToggle?.(!ultraFireMode)}
          className={cn(
            "flex items-center gap-1 rounded font-bold uppercase transition-all border",
            fs ? "px-2 py-1 text-[8px]" : "px-1.5 py-0.5 text-[6px]",
            ultraFireMode
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
              : 'bg-surface-2/30 border-border/10 text-muted-foreground/30'
          )}>
          <Zap className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5")} />
          UltraFire
        </button>
        {ultraFireMode && (
          <input
            type="text" maxLength={6} placeholder="Verify"
            value={verifyCode} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className={cn(
              "bg-surface-2/20 border border-border/20 rounded font-mono text-foreground/60 placeholder:text-muted-foreground/20",
              fs ? "w-20 px-2 py-1 text-[9px]" : "w-16 px-1.5 py-0.5 text-[7px]"
            )}
          />
        )}

        {/* Semi-auto event indicator */}
        {fireMode === 'semi-auto' && (
          <div className={cn("flex items-center gap-1 ml-auto", fs ? "text-[9px]" : "text-[7px]")}>
            <span className="text-muted-foreground/40">Event:</span>
            <span className="text-primary font-bold">{currentEvent}/{maxEvent}</span>
            <Button variant="ghost" size="icon" onClick={handleSemiAutoGo}
              disabled={!isRunning || currentEvent >= maxEvent}
              className={cn(fs ? "h-6 w-6" : "h-5 w-5")}>
              <SkipForward className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "text-green-400")} />
            </Button>
          </div>
        )}
      </div>

      {/* Priority Disable row (16 toggles) */}
      <div className={cn(
        "flex items-center gap-0.5 border-b border-border/15 overflow-x-auto",
        fs ? "px-4 py-1.5" : "px-2 py-1"
      )} style={{ background: 'hsl(220 10% 6%)' }}>
        <span className={cn("text-muted-foreground/30 font-bold mr-1 shrink-0", fs ? "text-[8px]" : "text-[6px]")}>PRI:</span>
        {Array.from({ length: FIREONE_PRIORITY_GROUPS }, (_, i) => i + 1).map(p => {
          const enabled = priorities?.get(p) ?? true;
          return (
            <button key={p} onClick={() => onPriorityToggle?.(p, !enabled)}
              className={cn(
                "rounded font-mono transition-all shrink-0 flex items-center justify-center",
                fs ? "w-5 h-5 text-[7px]" : "w-4 h-4 text-[5px]",
                enabled
                  ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                  : 'bg-red-600/20 text-red-400/50 border border-red-500/20'
              )}
              title={`Priority ${p}: ${enabled ? 'Enabled' : 'Disabled'}`}>
              {p}
            </button>
          );
        })}
      </div>

      {/* Music progress bar */}
      <div className={cn(
        "border-b border-border/15",
        fs ? "px-4 py-2" : "px-2 py-1"
      )} style={{ background: 'hsl(220 12% 6%)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Music className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "text-green-400/60")} />
          <span className={cn("font-bold text-foreground/50 truncate", fs ? "text-[10px]" : "text-[7px]")}>{musicFile}</span>
        </div>
        <div className={cn("w-full rounded-full overflow-hidden", fs ? "h-3" : "h-1.5")} style={{ background: 'hsl(220 10% 12%)' }}>
          <div className="h-full rounded-full transition-all" style={{
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, hsl(200 80% 50%), hsl(160 70% 45%))',
          }} />
        </div>
        {/* CUE distribution markers */}
        <div className="relative w-full h-1 mt-0.5">
          {cues.map(c => (
            <div key={c.id} className={cn(
              "absolute top-0 w-0.5 rounded-full",
              c.state === 'active' ? 'bg-red-400' : c.state === 'done' ? 'bg-muted-foreground/15' : 'bg-amber-400/50',
              fs ? "h-1.5" : "h-1"
            )} style={{ left: `${(c.timecodeMs / dotLengthMs) * 100}%` }} />
          ))}
        </div>
      </div>

      {/* Trigger source + controls */}
      <div className={cn(
        "flex items-center justify-between border-b border-border/15",
        fs ? "px-4 py-2" : "px-2 py-1"
      )} style={{ background: 'hsl(220 10% 7%)' }}>
        <div className="flex items-center gap-1">
          {(['manual', 'midi', 'ltc'] as const).map(src => (
            <button key={src} onClick={() => setTriggerSource(src)}
              className={cn(
                "rounded font-bold uppercase transition-all border",
                fs ? "px-3 py-1.5 text-[10px]" : "px-2 py-1 text-[7px]",
                triggerSource === src
                  ? src === 'midi' ? 'bg-purple-500/15 border-purple-500/40 text-purple-400'
                  : src === 'ltc' ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                  : 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-surface-2/30 border-border/10 text-muted-foreground/30'
              )}>
              {src}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleReset}
            className={cn(fs ? "h-8 w-8" : "h-6 w-6")}>
            <RotateCcw className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />
          </Button>
          <button onClick={() => setTimeOffset(prev => prev - 200)}
            className={cn("rounded font-mono text-muted-foreground/40 hover:text-foreground/60 transition-colors", fs ? "px-2 py-1 text-[9px]" : "px-1.5 py-0.5 text-[7px]")}>
            -200ms
          </button>
          <button onClick={() => setTimeOffset(prev => prev + 200)}
            className={cn("rounded font-mono text-muted-foreground/40 hover:text-foreground/60 transition-colors", fs ? "px-2 py-1 text-[9px]" : "px-1.5 py-0.5 text-[7px]")}>
            +200ms
          </button>
        </div>
      </div>

      {/* CUE list table */}
      <ScrollArea className="flex-1">
        <div className={cn(fs ? "text-[10px]" : "text-[7px]")}>
          {/* Header */}
          <div className={cn(
            "grid grid-cols-[2rem_2.5rem_minmax(0,1fr)_3rem_4rem_3rem_2rem_minmax(0,1fr)_2.5rem_2rem_2rem] items-center font-bold text-muted-foreground/30 uppercase border-b border-border/15",
            fs ? "gap-2 px-4 py-1.5 grid-cols-[2.5rem_3rem_minmax(0,1fr)_4rem_5rem_4rem_3rem_minmax(0,1fr)_3rem_2.5rem_2.5rem]" : "gap-1 px-2 py-0.5"
          )} style={{ background: 'hsl(220 10% 9%)' }}>
            <span>CUE</span><span>Dev</span><span>Name</span><span>State</span><span>Timecode</span>
            <span>Addr</span><span>Mode</span><span>Effect</span><span>Dur</span><span>Pre</span><span>Evt</span>
          </div>
          {/* Rows */}
          {cues.map((cue, i) => {
            const isEventBoundary = i > 0 && (cue.eventNumber ?? 0) !== (cues[i - 1]?.eventNumber ?? 0) && fireMode === 'semi-auto';
            const priorityDisabled = cue.priority && priorities && !priorities.get(cue.priority);
            return (
              <div key={cue.id}>
                {isEventBoundary && (
                  <div className={cn("border-t-2 border-amber-500/30 flex items-center gap-1",
                    fs ? "px-4 py-0.5 text-[8px]" : "px-2 py-0 text-[6px]"
                  )} style={{ background: 'hsl(40 80% 10% / 0.3)' }}>
                    <SkipForward className="w-2.5 h-2.5 text-amber-400/60" />
                    <span className="text-amber-400/60 font-bold">EVENT {cue.eventNumber ?? 0}</span>
                  </div>
                )}
                <div className={cn(
                  "grid items-center border-b transition-colors",
                  fs ? "grid-cols-[2.5rem_3rem_minmax(0,1fr)_4rem_5rem_4rem_3rem_minmax(0,1fr)_3rem_2.5rem_2.5rem] gap-2 px-4 py-1.5" : "grid-cols-[2rem_2.5rem_minmax(0,1fr)_3rem_4rem_3rem_2rem_minmax(0,1fr)_2.5rem_2rem_2rem] gap-1 px-2 py-0.5",
                  priorityDisabled ? 'opacity-30 bg-red-900/5 border-red-800/10' :
                  cue.state === 'active' ? 'bg-red-600/10 border-red-800/20' :
                  cue.state === 'done' ? 'bg-surface-1/10 border-border/5' :
                  cue.state === 'queued' ? 'bg-amber-600/5 border-amber-800/10' :
                  'border-border/10 hover:bg-surface-2/20'
                )}>
                  <span className="font-mono text-muted-foreground/40">{cue.cueNumber}</span>
                  <span className={cn("uppercase font-bold", cue.device === 'pyro' ? 'text-red-400/60' : 'text-cyan-400/60')}>{cue.device === 'pyro' ? 'Pyro' : 'Dmx'}</span>
                  <span className="font-bold text-foreground/70 truncate">{cue.name}</span>
                  <span className={cn("font-bold uppercase", stateColor(cue.state))}>{cue.state}</span>
                  <span className="font-mono text-foreground/50">{formatTimecode(cue.timecodeMs)}</span>
                  <span className="font-mono text-muted-foreground/50 truncate">{cue.addresses}</span>
                  <span className="text-center">{FIRING_RULES.find(r => r.key === cue.mode)?.label || '↑↑↑'}</span>
                  <span className="text-foreground/60 truncate">{cue.effect}</span>
                  <span className="font-mono text-muted-foreground/40">{cue.duration}</span>
                  <span className="font-mono text-muted-foreground/40">{cue.prefire}</span>
                  <span className="font-mono text-muted-foreground/30">{cue.eventNumber ?? '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Bottom controls */}
      <div className={cn(
        "flex items-center justify-between border-t border-border/20",
        fs ? "px-4 py-2" : "px-2 py-1"
      )} style={{ background: 'hsl(220 12% 6%)' }}>
        <input ref={fileInputRef} type="file" accept=".csv,.fir,.sem,.ses,.scl" onChange={handleFileImport} className="hidden" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className={cn(fs ? "text-[9px] h-7" : "text-[7px] h-5")}>
            <Upload className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "mr-1")} /> Import
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExportCSV} className={cn(fs ? "text-[9px] h-7" : "text-[7px] h-5")}>
            <Download className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "mr-1")} /> CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExportFlames} className={cn(fs ? "text-[9px] h-7" : "text-[7px] h-5")}>
            <Download className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "mr-1")} /> Flames
          </Button>
          <Button variant="ghost" size="sm" className={cn(fs ? "text-[9px] h-7" : "text-[7px] h-5")}>
            <Trash2 className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "mr-1")} /> Delete
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {fireMode === 'semi-auto' && isRunning && (
            <button onClick={handleSemiAutoGo}
              disabled={currentEvent >= maxEvent}
              className={cn(
                "rounded font-black uppercase transition-all flex items-center gap-1 bg-amber-600/20 text-amber-400 border border-amber-500/40 hover:bg-amber-600/30",
                fs ? "px-4 py-2 text-xs" : "px-2 py-1 text-[8px]",
              )}>
              <SkipForward className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />
              GO
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={!dmxArm && !pyroArm}
            className={cn(
              "rounded font-black uppercase transition-all flex items-center gap-1",
              fs ? "px-6 py-2 text-sm" : "px-3 py-1 text-[9px]",
              isRunning
                ? "bg-red-600/30 text-red-400 border border-red-500/40"
                : (dmxArm || pyroArm)
                  ? "bg-green-600/20 text-green-400 border border-green-500/40 hover:bg-green-600/30"
                  : "bg-surface-2/30 text-muted-foreground/20 border border-border/10"
            )}>
            {isRunning ? <Square className={cn(fs ? "w-4 h-4" : "w-3 h-3")} /> : <Play className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />}
            {isRunning ? 'STOP' : 'RUN'}
          </button>
        </div>
      </div>
    </div>
  );
}
