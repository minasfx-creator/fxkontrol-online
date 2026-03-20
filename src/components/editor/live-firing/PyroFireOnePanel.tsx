/**
 * PyroFireOnePanel — FireOne XL4+ style pyrotechnic firing panel
 * Full XL4 replica: 99 modules × 32 igniters, continuity, safety interlocks,
 * Manual / Step / Timecode / Test modes, AutoFire bridge
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Shield, ShieldAlert, Hand, AlertTriangle, Zap, Radio,
  ChevronLeft, ChevronRight, RotateCcw, Play, Square, SkipForward,
  CheckCircle2, XCircle, Clock, Activity, Battery, Signal,
  Lock, Unlock, Search, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { SFXChannel, AutoFireCue } from './types';
import { DEMO_CUES } from './AutoFirePanel';
import { formatTimecode } from './constants';

interface PyroFireOnePanelProps {
  fs: boolean;
  fireChannel: (id: string) => void;
  channels: SFXChannel[];
  pyroArm: boolean;
  dmxArm: boolean;
  deadmanHeld: boolean;
  handlePanic: () => void;
  artNetConnected: boolean;
  relayConnected: boolean;
}

type PyroMode = 'manual' | 'step' | 'timecode' | 'test';

interface FieldModule {
  address: number;
  connected: boolean;
  armed: boolean;
  batteryVoltage: number;
  signalStrength: number;
  temperature: number;
  igniters: IgniterState[];
}

interface IgniterState {
  position: number;
  connected: boolean;
  fired: boolean;
  resistance: number; // ohms — 0 = open, 1-50 = good, >50 = suspect
  misfire: boolean;
}

function createSimModule(addr: number, connected: boolean): FieldModule {
  return {
    address: addr,
    connected,
    armed: false,
    batteryVoltage: connected ? 11.2 + Math.random() * 1.6 : 0,
    signalStrength: connected ? 60 + Math.random() * 40 : 0,
    temperature: connected ? 18 + Math.random() * 12 : 0,
    igniters: Array.from({ length: 32 }, (_, i) => ({
      position: i + 1,
      connected: connected && Math.random() > 0.15,
      fired: false,
      resistance: connected ? (Math.random() > 0.15 ? 1.2 + Math.random() * 8 : 0) : 0,
      misfire: false,
    })),
  };
}

export default function PyroFireOnePanel({
  fs, fireChannel, channels, pyroArm, dmxArm, deadmanHeld, handlePanic, artNetConnected, relayConnected,
}: PyroFireOnePanelProps) {
  const [pyroMode, setPyroMode] = useState<PyroMode>('manual');
  const [modules, setModules] = useState<FieldModule[]>(() => {
    const mods: FieldModule[] = [];
    for (let i = 1; i <= 6; i++) mods.push(createSimModule(i, true));
    return mods;
  });
  const [selectedModule, setSelectedModule] = useState(1);
  const [masterKeyOn, setMasterKeyOn] = useState(false);
  const [simMode, setSimMode] = useState(true);

  // Step mode
  const [stepIndex, setStepIndex] = useState(0);
  const [stepCues, setStepCues] = useState<AutoFireCue[]>([]);

  // Timecode mode
  const [tcRunning, setTcRunning] = useState(false);
  const [tcTimeMs, setTcTimeMs] = useState(0);
  const [tcCues, setTcCues] = useState<AutoFireCue[]>([]);
  const tcTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tcFiredSet = useRef<Set<string>>(new Set());

  const currentModule = useMemo(() => modules.find(m => m.address === selectedModule), [modules, selectedModule]);

  const canFire = masterKeyOn && (pyroArm || dmxArm) && deadmanHeld;

  // Import pyro cues from AutoFire
  const importPyroCues = useCallback(() => {
    const pyroCues = DEMO_CUES.filter(c => c.device === 'pyro');
    setTcCues(pyroCues);
    setStepCues(pyroCues);
    setStepIndex(0);
    toast.success(`Imported ${pyroCues.length} pyro cues from AutoFire`);
    // Broadcast via realtime
    supabase.channel('fxc-pyro-sync').send({
      type: 'broadcast', event: 'pyro-cues-sync',
      payload: { cues: pyroCues },
    }).catch(() => {});
  }, []);

  // ARM module
  const armModule = useCallback((addr: number, armed: boolean) => {
    if (!masterKeyOn) { toast.error('Master Key must be ON to arm'); return; }
    setModules(prev => prev.map(m => m.address === addr ? { ...m, armed } : m));
    toast.info(`Module FM-${String(addr).padStart(2, '0')} ${armed ? 'ARMED' : 'DISARMED'}`);
  }, [masterKeyOn]);

  const armAll = useCallback((armed: boolean) => {
    if (!masterKeyOn) { toast.error('Master Key must be ON'); return; }
    setModules(prev => prev.map(m => m.connected ? { ...m, armed } : m));
    toast.warning(armed ? '⚠️ ALL MODULES ARMED' : 'All modules disarmed');
  }, [masterKeyOn]);

  // Fire igniter
  const fireIgniter = useCallback((moduleAddr: number, igniterPos: number) => {
    if (!canFire) return;
    const mod = modules.find(m => m.address === moduleAddr);
    if (!mod?.armed || !mod.connected) return;
    const ig = mod.igniters.find(i => i.position === igniterPos);
    if (!ig?.connected || ig.fired) return;

    // Haptic
    if (navigator.vibrate) navigator.vibrate(40);

    // Update igniter state
    setModules(prev => prev.map(m => {
      if (m.address !== moduleAddr) return m;
      return {
        ...m,
        igniters: m.igniters.map(i => {
          if (i.position !== igniterPos) return i;
          const misfire = !simMode ? false : Math.random() < 0.03;
          return { ...i, fired: !misfire, misfire, resistance: misfire ? i.resistance : 0 };
        }),
      };
    }));

    // Bridge to FXC channels
    const chIdx = (moduleAddr - 1) * 32 + (igniterPos - 1);
    if (chIdx < channels.length) {
      fireChannel(channels[chIdx].id);
    }

    // Broadcast
    supabase.channel('fxc-mobile-link').send({
      type: 'broadcast', event: 'fxc-fire',
      payload: { channelId: chIdx < channels.length ? channels[chIdx].id : null, module: moduleAddr, igniter: igniterPos, source: 'pyro-panel' },
    }).catch(() => {});

    toast.success(`FIRE FM-${String(moduleAddr).padStart(2, '0')} · I-${String(igniterPos).padStart(2, '0')}`, { duration: 1500 });
  }, [canFire, modules, channels, fireChannel, simMode]);

  // Step mode: advance
  const stepFire = useCallback(() => {
    if (!canFire || stepCues.length === 0) return;
    const cue = stepCues[stepIndex];
    if (!cue) return;
    // Parse addresses to fire
    const addrs = cue.addresses.split(':').map(Number);
    addrs.forEach(a => {
      const modAddr = Math.floor(a / 32) + 1;
      const igPos = (a % 32) + 1;
      fireIgniter(modAddr, igPos);
    });
    setStepIndex(prev => Math.min(prev + 1, stepCues.length - 1));
  }, [canFire, stepCues, stepIndex, fireIgniter]);

  // Timecode mode
  useEffect(() => {
    if (!tcRunning) return;
    tcTimer.current = setInterval(() => {
      setTcTimeMs(prev => {
        const next = prev + 100;
        // Check cues
        tcCues.forEach(cue => {
          if (!tcFiredSet.current.has(cue.id) && next >= cue.timecodeMs) {
            tcFiredSet.current.add(cue.id);
            const addrs = cue.addresses.split(':').map(Number);
            addrs.forEach(a => {
              const modAddr = Math.floor(a / 32) + 1;
              const igPos = (a % 32) + 1;
              fireIgniter(modAddr, igPos);
            });
          }
        });
        return next;
      });
    }, 100);
    return () => { if (tcTimer.current) clearInterval(tcTimer.current); };
  }, [tcRunning, tcCues, fireIgniter]);

  const resetTimecode = useCallback(() => {
    setTcRunning(false);
    setTcTimeMs(0);
    tcFiredSet.current.clear();
    if (tcTimer.current) clearInterval(tcTimer.current);
  }, []);

  // Continuity test
  const runContinuityTest = useCallback(() => {
    if (!currentModule?.connected) return;
    toast.info(`Testing FM-${String(selectedModule).padStart(2, '0')} continuity...`);
    setTimeout(() => {
      setModules(prev => prev.map(m => {
        if (m.address !== selectedModule) return m;
        return {
          ...m,
          igniters: m.igniters.map(ig => ({
            ...ig,
            resistance: ig.connected ? 1.5 + Math.random() * 6 : 0,
          })),
        };
      }));
      const mod = modules.find(m => m.address === selectedModule);
      const good = mod?.igniters.filter(i => i.connected).length || 0;
      toast.success(`Continuity: ${good}/32 OK`);
    }, 1200);
  }, [currentModule, selectedModule, modules]);

  const connectedCount = modules.filter(m => m.connected).length;
  const armedModCount = modules.filter(m => m.armed).length;
  const totalIgniters = modules.reduce((sum, m) => sum + m.igniters.filter(i => i.connected && !i.fired).length, 0);
  const firedCount = modules.reduce((sum, m) => sum + m.igniters.filter(i => i.fired).length, 0);
  const misfireCount = modules.reduce((sum, m) => sum + m.igniters.filter(i => i.misfire).length, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header: Master Key + Status */}
      <div className={cn("border-b border-border/15 flex items-center justify-between", fs ? "px-4 py-2" : "px-2 py-1")} style={{ background: 'hsl(0 20% 7%)' }}>
        <div className="flex items-center gap-2">
          <span className={cn("font-black text-red-400/80 tracking-wider", fs ? "text-xs" : "text-[8px]")}>🔥 FIREONE XL4+</span>
          <span className={cn("font-mono text-muted-foreground/30", fs ? "text-[9px]" : "text-[7px]")}>{connectedCount} MOD · {totalIgniters} IG</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono", fs ? "text-[8px]" : "text-[6px]", simMode ? "text-amber-400/60" : "text-green-400/60")}>{simMode ? 'SIM' : 'LIVE'}</span>
          <Switch checked={!simMode} onCheckedChange={(v) => setSimMode(!v)} className="scale-75" />
        </div>
      </div>

      {/* Master Key Switch */}
      <div className={cn("border-b flex items-center gap-3", fs ? "px-4 py-2" : "px-2 py-1",
        masterKeyOn ? "border-red-800/30" : "border-border/15"
      )} style={{ background: masterKeyOn ? 'hsl(0 30% 8%)' : 'hsl(220 12% 7%)' }}>
        <button onClick={() => setMasterKeyOn(!masterKeyOn)}
          className={cn(
            "flex items-center gap-2 rounded border-2 font-black uppercase transition-all",
            fs ? "px-4 py-2 text-[10px]" : "px-3 py-1.5 text-[8px]",
            masterKeyOn
              ? "bg-red-600/20 border-red-500/50 text-red-400"
              : "bg-[hsl(220_10%_10%)] border-border/20 text-muted-foreground/40"
          )}>
          {masterKeyOn ? <Unlock className={cn(fs ? "w-4 h-4" : "w-3 h-3")} /> : <Lock className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />}
          MASTER KEY {masterKeyOn ? 'ON' : 'OFF'}
        </button>
        <div className="flex items-center gap-1.5">
          <button onClick={() => armAll(true)} disabled={!masterKeyOn}
            className={cn("rounded border font-bold uppercase transition-all",
              fs ? "px-3 py-1.5 text-[9px]" : "px-2 py-1 text-[7px]",
              masterKeyOn ? "bg-red-600/15 border-red-500/30 text-red-400/80" : "border-border/10 text-muted-foreground/20"
            )}>ARM ALL</button>
          <button onClick={() => armAll(false)} disabled={!masterKeyOn}
            className={cn("rounded border font-bold uppercase transition-all",
              fs ? "px-3 py-1.5 text-[9px]" : "px-2 py-1 text-[7px]",
              masterKeyOn ? "bg-green-600/10 border-green-500/30 text-green-400/80" : "border-border/10 text-muted-foreground/20"
            )}>DISARM ALL</button>
        </div>
        <span className={cn("font-mono ml-auto", fs ? "text-[9px]" : "text-[7px]",
          armedModCount > 0 ? "text-red-400 font-bold" : "text-muted-foreground/30"
        )}>{armedModCount}/{connectedCount} ARMED</span>
      </div>

      {/* Status strip */}
      {(firedCount > 0 || misfireCount > 0) && (
        <div className={cn("flex items-center gap-3 border-b border-border/10", fs ? "px-4 py-1" : "px-2 py-0.5")} style={{ background: 'hsl(220 10% 6%)' }}>
          <span className={cn("font-mono text-green-400/70", fs ? "text-[9px]" : "text-[7px]")}>✓ {firedCount} fired</span>
          {misfireCount > 0 && <span className={cn("font-mono text-red-400 font-bold animate-pulse", fs ? "text-[9px]" : "text-[7px]")}>⚠ {misfireCount} misfire</span>}
        </div>
      )}

      {/* Mode tabs */}
      <div className={cn("flex border-b border-border/15")} style={{ background: 'hsl(220 10% 7%)' }}>
        {([
          { key: 'manual' as PyroMode, label: 'Manual' },
          { key: 'step' as PyroMode, label: 'Step' },
          { key: 'timecode' as PyroMode, label: 'Timecode' },
          { key: 'test' as PyroMode, label: 'Test' },
        ]).map(m => (
          <button key={m.key} onClick={() => setPyroMode(m.key)}
            className={cn(
              "flex-1 font-bold uppercase tracking-wider transition-all border-b-2",
              fs ? "py-2 text-[10px]" : "py-1.5 text-[7px]",
              pyroMode === m.key ? "text-red-400/80 border-red-500/60" : "text-muted-foreground/30 border-transparent"
            )}>{m.label}</button>
        ))}
      </div>

      {/* Module selector */}
      <div className={cn("flex items-center gap-1 border-b border-border/10 overflow-x-auto", fs ? "px-3 py-1.5" : "px-2 py-1")} style={{ background: 'hsl(220 12% 6%)' }}>
        {modules.map(m => (
          <button key={m.address} onClick={() => setSelectedModule(m.address)}
            className={cn(
              "rounded border font-mono font-bold shrink-0 transition-all",
              fs ? "px-2.5 py-1.5 text-[9px]" : "px-2 py-1 text-[7px]",
              selectedModule === m.address
                ? m.armed ? "bg-red-600/20 border-red-500/40 text-red-400" : "bg-primary/15 border-primary/40 text-primary"
                : m.armed ? "bg-red-600/10 border-red-800/20 text-red-400/50"
                : m.connected ? "bg-[hsl(220_10%_10%)] border-border/15 text-foreground/50" : "bg-[hsl(220_10%_7%)] border-border/5 text-muted-foreground/15"
            )}>
            FM-{String(m.address).padStart(2, '0')}
            {m.armed && <span className="ml-1 text-red-400">●</span>}
          </button>
        ))}
        <button onClick={() => importPyroCues()}
          className={cn("rounded border shrink-0 transition-all font-bold",
            fs ? "px-2.5 py-1.5 text-[8px]" : "px-2 py-1 text-[6px]",
            "bg-amber-600/10 border-amber-500/20 text-amber-400/70"
          )}>
          <Download className={cn(fs ? "w-3 h-3 inline mr-1" : "w-2.5 h-2.5 inline mr-0.5")} />Import
        </button>
      </div>

      {/* Module info bar */}
      {currentModule && (
        <div className={cn("flex items-center gap-3 border-b border-border/10", fs ? "px-4 py-1" : "px-2 py-0.5")} style={{ background: 'hsl(220 10% 8%)' }}>
          <div className="flex items-center gap-1">
            <Battery className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", currentModule.batteryVoltage > 11 ? "text-green-400/70" : "text-amber-400")} />
            <span className={cn("font-mono", fs ? "text-[8px]" : "text-[6px]", "text-muted-foreground/50")}>{currentModule.batteryVoltage.toFixed(1)}V</span>
          </div>
          <div className="flex items-center gap-1">
            <Signal className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "text-cyan-400/60")} />
            <span className={cn("font-mono text-muted-foreground/50", fs ? "text-[8px]" : "text-[6px]")}>{Math.round(currentModule.signalStrength)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Activity className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "text-muted-foreground/40")} />
            <span className={cn("font-mono text-muted-foreground/50", fs ? "text-[8px]" : "text-[6px]")}>{Math.round(currentModule.temperature)}°C</span>
          </div>
          <button onClick={() => armModule(currentModule.address, !currentModule.armed)} disabled={!masterKeyOn}
            className={cn("ml-auto rounded border font-bold uppercase transition-all",
              fs ? "px-2.5 py-1 text-[8px]" : "px-2 py-0.5 text-[6px]",
              currentModule.armed ? "bg-red-600/20 border-red-500/40 text-red-400" : masterKeyOn ? "border-border/20 text-muted-foreground/50" : "border-border/10 text-muted-foreground/15"
            )}>
            {currentModule.armed ? '● ARMED' : 'ARM'}
          </button>
        </div>
      )}

      {/* Main content by mode */}
      <ScrollArea className="flex-1">
        {pyroMode === 'manual' && currentModule && (
          <div className={cn(fs ? "p-3" : "p-2")}>
            {!canFire && (masterKeyOn || pyroArm || dmxArm) && (
              <div className={cn("text-center text-amber-400/50 font-bold uppercase mb-2", fs ? "text-[10px]" : "text-[7px]")}>
                {!masterKeyOn ? 'Turn Master Key ON' : !deadmanHeld ? 'Hold DEADMAN to fire' : 'ARM system to fire'}
              </div>
            )}
            {/* 8×4 igniter grid */}
            <div className={cn("grid grid-cols-8", fs ? "gap-1.5" : "gap-1")}>
              {currentModule.igniters.map(ig => {
                const ok = ig.connected && !ig.fired && ig.resistance > 0;
                const canFireIg = canFire && currentModule.armed && ok;
                return (
                  <button key={ig.position}
                    onMouseDown={() => canFireIg && fireIgniter(currentModule.address, ig.position)}
                    onTouchStart={(e) => { e.preventDefault(); if (canFireIg) fireIgniter(currentModule.address, ig.position); }}
                    disabled={!canFireIg && !ig.fired}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded border transition-all select-none",
                      fs ? "min-h-[56px] rounded-lg" : "min-h-[40px]",
                      ig.fired ? "bg-muted-foreground/10 border-border/10" :
                      ig.misfire ? "bg-red-600/20 border-red-500/40 animate-pulse" :
                      canFireIg ? "bg-[hsl(220_10%_12%)] border-border/30 hover:bg-red-700/20 active:scale-[0.93] active:bg-red-600/30 cursor-pointer" :
                      ig.connected ? "bg-[hsl(220_10%_10%)] border-border/15" :
                      "bg-[hsl(220_10%_6%)] border-border/5"
                    )}>
                    {/* Continuity LED */}
                    <div className={cn("absolute rounded-full",
                      fs ? "w-2 h-2 top-1 right-1" : "w-1.5 h-1.5 top-0.5 right-0.5",
                      ig.fired ? "bg-muted-foreground/20" :
                      ig.misfire ? "bg-red-500" :
                      ok ? "bg-green-500" :
                      ig.connected ? "bg-amber-400" : "bg-muted-foreground/10"
                    )} style={ok && !ig.fired ? { boxShadow: '0 0 4px rgba(34,197,94,0.4)' } : ig.misfire ? { boxShadow: '0 0 6px rgba(239,68,68,0.6)' } : undefined} />
                    <span className={cn("font-mono font-bold",
                      fs ? "text-[10px]" : "text-[7px]",
                      ig.fired ? "text-muted-foreground/20" : ig.misfire ? "text-red-400" : ok ? "text-foreground/60" : "text-muted-foreground/15"
                    )}>{String(ig.position).padStart(2, '0')}</span>
                    <span className={cn("font-mono",
                      fs ? "text-[7px]" : "text-[5px]",
                      ig.fired ? "text-muted-foreground/15" : ok ? "text-green-400/50" : "text-muted-foreground/15"
                    )}>{ig.resistance > 0 ? `${ig.resistance.toFixed(1)}Ω` : '—'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {pyroMode === 'step' && (
          <div className={cn(fs ? "p-3" : "p-2")}>
            {stepCues.length === 0 ? (
              <div className={cn("text-center text-muted-foreground/30 py-8", fs ? "text-sm" : "text-[10px]")}>
                No pyro cues. Tap <strong>Import</strong> to load from AutoFire.
              </div>
            ) : (
              <>
                <div className={cn("flex items-center justify-between mb-2")}>
                  <span className={cn("font-bold text-foreground/60", fs ? "text-xs" : "text-[9px]")}>
                    Step {stepIndex + 1} / {stepCues.length}
                  </span>
                  <button onClick={() => { setStepIndex(0); toast.info('Step reset'); }}
                    className={cn("rounded text-muted-foreground/40 hover:text-foreground/60", fs ? "text-[9px] px-2 py-1" : "text-[7px] px-1.5 py-0.5")}>
                    <RotateCcw className={cn(fs ? "w-3 h-3 inline mr-1" : "w-2.5 h-2.5 inline mr-0.5")} />Reset
                  </button>
                </div>
                {/* Current cue */}
                {stepCues[stepIndex] && (
                  <div className={cn("rounded border mb-2",
                    fs ? "p-3 border-red-500/20" : "p-2 border-border/15"
                  )} style={{ background: 'hsl(0 20% 8%)' }}>
                    <div className={cn("font-bold text-red-400/80", fs ? "text-sm" : "text-[9px]")}>{stepCues[stepIndex].name}</div>
                    <div className={cn("font-mono text-muted-foreground/40", fs ? "text-[9px]" : "text-[7px]")}>
                      TC: {formatTimecode(stepCues[stepIndex].timecodeMs)} · Addr: {stepCues[stepIndex].addresses} · {stepCues[stepIndex].effect}
                    </div>
                  </div>
                )}
                <button onClick={stepFire} disabled={!canFire}
                  className={cn(
                    "w-full rounded-lg font-black uppercase transition-all border-2 flex items-center justify-center gap-2",
                    fs ? "py-4 text-base" : "py-3 text-sm",
                    canFire
                      ? "bg-gradient-to-b from-red-600 to-red-800 text-white border-red-500/50 active:scale-[0.97]"
                      : "bg-[hsl(220_10%_10%)] text-muted-foreground/20 border-border/10"
                  )}>
                  <SkipForward className={cn(fs ? "w-5 h-5" : "w-4 h-4")} />
                  NEXT FIRE
                </button>
                {/* Cue list */}
                <div className={cn("mt-2 space-y-0.5")}>
                  {stepCues.map((cue, i) => (
                    <div key={cue.id} className={cn(
                      "flex items-center gap-2 rounded border transition-colors",
                      fs ? "px-3 py-1.5 text-[9px]" : "px-2 py-1 text-[7px]",
                      i === stepIndex ? "bg-red-600/10 border-red-500/20 text-foreground/80" :
                      i < stepIndex ? "border-border/5 text-muted-foreground/20" :
                      "border-border/10 text-muted-foreground/40"
                    )}>
                      <span className="font-mono w-5">{cue.cueNumber}</span>
                      <span className="font-bold flex-1 truncate">{cue.name}</span>
                      <span className="font-mono">{formatTimecode(cue.timecodeMs)}</span>
                      {i < stepIndex && <CheckCircle2 className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "text-green-400/50")} />}
                      {i === stepIndex && <Zap className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "text-red-400")} />}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {pyroMode === 'timecode' && (
          <div className={cn(fs ? "p-3" : "p-2")}>
            {/* TC Display */}
            <div className={cn("text-center font-mono font-black mb-2",
              fs ? "text-2xl" : "text-lg",
              tcRunning ? "text-red-400" : "text-foreground/60"
            )}>{formatTimecode(tcTimeMs)}</div>
            {tcCues.length === 0 ? (
              <div className={cn("text-center text-muted-foreground/30 py-4", fs ? "text-sm" : "text-[10px]")}>
                No pyro cues. Tap <strong>Import</strong> to load from AutoFire.
              </div>
            ) : (
              <>
                <div className={cn("flex items-center justify-center gap-2 mb-3")}>
                  <Button variant="ghost" size="sm" onClick={resetTimecode}
                    className={cn(fs ? "h-8" : "h-6", "text-[9px]")}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Reset
                  </Button>
                  <button onClick={() => { if (!canFire && !tcRunning) { toast.error('ARM + DEADMAN required'); return; } setTcRunning(!tcRunning); }}
                    disabled={!canFire && !tcRunning}
                    className={cn(
                      "rounded-lg font-black uppercase transition-all border-2 flex items-center gap-2",
                      fs ? "px-6 py-2.5 text-sm" : "px-4 py-2 text-[10px]",
                      tcRunning
                        ? "bg-red-600/30 border-red-500/40 text-red-400"
                        : canFire
                          ? "bg-green-600/20 border-green-500/40 text-green-400"
                          : "bg-[hsl(220_10%_10%)] border-border/10 text-muted-foreground/20"
                    )}>
                    {tcRunning ? <Square className={cn(fs ? "w-4 h-4" : "w-3 h-3")} /> : <Play className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />}
                    {tcRunning ? 'STOP' : 'RUN'}
                  </button>
                </div>
                {/* Progress */}
                <div className={cn("w-full rounded-full overflow-hidden mb-2", fs ? "h-2" : "h-1")} style={{ background: 'hsl(220 10% 12%)' }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.min(100, tcCues.length > 0 ? (tcTimeMs / Math.max(...tcCues.map(c => c.timecodeMs + c.duration * 1000))) * 100 : 0)}%`,
                    background: 'linear-gradient(90deg, hsl(0 80% 50%), hsl(30 80% 50%))',
                  }} />
                </div>
                {/* Cue list */}
                <div className="space-y-0.5">
                  {tcCues.map(cue => {
                    const fired = tcFiredSet.current.has(cue.id);
                    return (
                      <div key={cue.id} className={cn(
                        "flex items-center gap-2 rounded border",
                        fs ? "px-3 py-1 text-[9px]" : "px-2 py-0.5 text-[7px]",
                        fired ? "border-border/5 text-muted-foreground/20" :
                        tcTimeMs >= cue.timecodeMs - 2000 ? "border-amber-500/20 bg-amber-600/5 text-amber-400/70" :
                        "border-border/10 text-muted-foreground/40"
                      )}>
                        <span className="font-mono w-5">{cue.cueNumber}</span>
                        <span className="font-bold flex-1 truncate">{cue.name}</span>
                        <span className="font-mono">{formatTimecode(cue.timecodeMs)}</span>
                        {fired && <CheckCircle2 className="w-3 h-3 text-green-400/50" />}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {pyroMode === 'test' && currentModule && (
          <div className={cn(fs ? "p-3" : "p-2")}>
            <div className={cn("flex items-center justify-between mb-3")}>
              <span className={cn("font-bold text-foreground/60 uppercase", fs ? "text-xs" : "text-[9px]")}>Continuity Test — FM-{String(selectedModule).padStart(2, '0')}</span>
              <button onClick={runContinuityTest} disabled={!currentModule.connected}
                className={cn("rounded border font-bold uppercase transition-all flex items-center gap-1",
                  fs ? "px-3 py-1.5 text-[9px]" : "px-2 py-1 text-[7px]",
                  currentModule.connected ? "bg-cyan-600/15 border-cyan-500/30 text-cyan-400" : "border-border/10 text-muted-foreground/15"
                )}>
                <Search className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5")} /> TEST
              </button>
            </div>
            {/* Igniter resistance grid */}
            <div className={cn("grid grid-cols-8", fs ? "gap-1.5" : "gap-1")}>
              {currentModule.igniters.map(ig => (
                <div key={ig.position} className={cn(
                  "flex flex-col items-center justify-center rounded border",
                  fs ? "py-2 min-h-[48px]" : "py-1.5 min-h-[36px]",
                  ig.connected && ig.resistance > 0 && ig.resistance < 30 ? "bg-green-600/10 border-green-500/20" :
                  ig.connected && ig.resistance >= 30 ? "bg-amber-600/10 border-amber-500/20" :
                  ig.connected ? "bg-red-600/10 border-red-500/20" :
                  "bg-[hsl(220_10%_6%)] border-border/5"
                )}>
                  <span className={cn("font-mono font-bold", fs ? "text-[9px]" : "text-[6px]",
                    ig.connected ? "text-foreground/50" : "text-muted-foreground/15"
                  )}>{String(ig.position).padStart(2, '0')}</span>
                  <span className={cn("font-mono",
                    fs ? "text-[8px]" : "text-[5px]",
                    ig.connected && ig.resistance > 0 && ig.resistance < 30 ? "text-green-400/70" :
                    ig.connected && ig.resistance >= 30 ? "text-amber-400/70" :
                    ig.connected ? "text-red-400/50" : "text-muted-foreground/10"
                  )}>
                    {ig.resistance > 0 ? `${ig.resistance.toFixed(1)}Ω` : ig.connected ? 'OPEN' : '—'}
                  </span>
                  {ig.connected && ig.resistance > 0 && ig.resistance < 30
                    ? <CheckCircle2 className={cn(fs ? "w-2.5 h-2.5" : "w-2 h-2", "text-green-400/50 mt-0.5")} />
                    : ig.connected
                      ? <XCircle className={cn(fs ? "w-2.5 h-2.5" : "w-2 h-2", "text-red-400/50 mt-0.5")} />
                      : null
                  }
                </div>
              ))}
            </div>
            {/* Summary */}
            <div className={cn("mt-3 rounded border border-border/10 flex items-center justify-around", fs ? "px-4 py-2" : "px-2 py-1")} style={{ background: 'hsl(220 10% 7%)' }}>
              <div className="text-center">
                <div className={cn("font-mono font-bold text-green-400", fs ? "text-sm" : "text-xs")}>{currentModule.igniters.filter(i => i.connected && i.resistance > 0 && i.resistance < 30).length}</div>
                <div className={cn("text-muted-foreground/30 uppercase", fs ? "text-[7px]" : "text-[5px]")}>Good</div>
              </div>
              <div className="text-center">
                <div className={cn("font-mono font-bold text-amber-400", fs ? "text-sm" : "text-xs")}>{currentModule.igniters.filter(i => i.connected && i.resistance >= 30).length}</div>
                <div className={cn("text-muted-foreground/30 uppercase", fs ? "text-[7px]" : "text-[5px]")}>Suspect</div>
              </div>
              <div className="text-center">
                <div className={cn("font-mono font-bold text-red-400", fs ? "text-sm" : "text-xs")}>{currentModule.igniters.filter(i => i.connected && i.resistance === 0).length}</div>
                <div className={cn("text-muted-foreground/30 uppercase", fs ? "text-[7px]" : "text-[5px]")}>Open</div>
              </div>
              <div className="text-center">
                <div className={cn("font-mono font-bold text-muted-foreground/30", fs ? "text-sm" : "text-xs")}>{currentModule.igniters.filter(i => !i.connected).length}</div>
                <div className={cn("text-muted-foreground/30 uppercase", fs ? "text-[7px]" : "text-[5px]")}>Empty</div>
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
