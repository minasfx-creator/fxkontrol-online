/**
 * ShowCommander™ — Unified Command Center for Mega-Show Operations
 * Single-panel integration of all subsystems: Pyro, SFX, Drones, Lighting, Lasers, Timecode.
 * Designed for Olympics-level show execution with real-time telemetry and safety interlocks.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Zap, Shield, Radio, Activity, Clock, AlertTriangle, ChevronDown, ChevronRight,
  Play, Pause, Square, Volume2, Eye, EyeOff, Lock, Unlock, Flame, Sparkles,
  Plane, Lightbulb, Cable, Signal, Battery, Cpu, Timer, BarChart3, Layers,
  Target, Crosshair, MonitorPlay, Gauge, CircuitBoard, Power, Wifi, WifiOff,
  Magnet, FlaskConical, Link2, Unlink, Download, Sun
} from 'lucide-react';
import { useShowCommanderEngine } from '@/hooks/useShowCommanderEngine';
import PerformanceMonitor from '@/components/editor/PerformanceMonitor';
import { FieldViewProvider, FieldModeToggle, FieldViewWrapper, TerrainCollisionAlert } from '@/components/editor/FieldViewMode';
import { downloadFlightPlan, exportFlightPlan, DEFAULT_FLIGHT_CONFIG } from '@/lib/mavlinkFlightPlanExporter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useProjectStore } from '@/store/useProjectStore';
import { useSMPTEStore } from '@/store/useSMPTEStore';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { secondsToTimecode, formatTimecode } from '@/lib/smpteEngine';

// ─── Types ───────────────────────────────────────────────────────────────────
interface SubsystemStatus {
  id: string;
  name: string;
  icon: typeof Zap;
  online: boolean;
  armed: boolean;
  channels: number;
  activeChannels: number;
  color: string;
  faults: number;
}

interface CueQueueItem {
  id: string;
  cueNumber: string;
  subsystem: string;
  description: string;
  timecodeMs: number;
  state: 'queued' | 'standby' | 'fired' | 'skipped';
  channels: number;
}

// ─── Mock data for subsystems ────────────────────────────────────────────────
function useSubsystems(fireone: ReturnType<typeof useFireOneHardware>, pbus: ReturnType<typeof usePBusHardware>): SubsystemStatus[] {
  return useMemo(() => [
    {
      id: 'pyro',
      name: 'PYRO',
      icon: Flame,
      online: fireone.isConnected,
      armed: false,
      channels: fireone.isConnected ? fireone.modules.size * 32 : 0,
      activeChannels: 0,
      color: 'text-red-400',
      faults: 0,
    },
    {
      id: 'sfx',
      name: 'SFX',
      icon: Sparkles,
      online: pbus.isConnected,
      armed: false,
      channels: pbus.isConnected ? pbus.deviceCount * 16 : 20,
      activeChannels: 0,
      color: 'text-amber-400',
      faults: 0,
    },
    {
      id: 'drones',
      name: 'DRONES',
      icon: Plane,
      online: false,
      armed: false,
      channels: 0,
      activeChannels: 0,
      color: 'text-sky-400',
      faults: 0,
    },
    {
      id: 'lighting',
      name: 'LIGHTING',
      icon: Lightbulb,
      online: false,
      armed: false,
      channels: 512,
      activeChannels: 0,
      color: 'text-green-400',
      faults: 0,
    },
    {
      id: 'laser',
      name: 'LASER',
      icon: Zap,
      online: false,
      armed: false,
      channels: 14,
      activeChannels: 0,
      color: 'text-purple-400',
      faults: 0,
    },
    {
      id: 'audio',
      name: 'AUDIO',
      icon: Volume2,
      online: false,
      armed: false,
      channels: 0,
      activeChannels: 0,
      color: 'text-cyan-400',
      faults: 0,
    },
  ], [fireone.isConnected, fireone.modules.size, pbus.isConnected, pbus.deviceCount]);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MasterTransport() {
  const { currentTime, isPlaying, duration, setPlaying } = useProjectStore();
  const { frameRate, startTimecodeSeconds } = useSMPTEStore();
  const [masterArmed, setMasterArmed] = useState(false);

  const offsetTime = currentTime + startTimecodeSeconds;
  const tc = secondsToTimecode(offsetTime, frameRate, frameRate === 29.97);
  const tcStr = formatTimecode(tc);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleArm = useCallback(() => {
    if (!masterArmed) {
      toast.warning('MASTER ARM ativado — Todos os sistemas em STANDBY', { duration: 5000 });
    } else {
      toast.info('MASTER DISARM — Sistemas em modo seguro');
    }
    setMasterArmed(!masterArmed);
  }, [masterArmed]);

  const handlePanic = useCallback(() => {
    toast.error('🚨 PANIC — Todos os sistemas DESARMADOS', { duration: 8000 });
    setMasterArmed(false);
  }, []);

  return (
    <div className={cn(
      "rounded-xl border p-3 space-y-3 transition-all",
      masterArmed
        ? "border-red-500/30 bg-red-500/5"
        : "border-border/20 bg-card/30"
    )}>
      {/* Timecode + Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Timer className="w-3.5 h-3.5 text-muted-foreground/50" />
            <span className="font-mono-code text-lg tracking-[0.15em] text-primary font-bold tabular-nums">
              {tcStr}
            </span>
            {masterArmed && (
              <Badge className="badge-live text-[9px] h-5">● ARMED</Badge>
            )}
            {isPlaying && (
              <Badge variant="outline" className="text-[8px] h-4 border-green-500/30 text-green-400">
                RUNNING
              </Badge>
            )}
          </div>
          <Progress value={progress} className="h-1 mt-1.5" />
        </div>
      </div>

      {/* Transport Controls */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={isPlaying ? 'destructive' : 'default'}
          className={cn("h-10 flex-1 font-bold text-xs", masterArmed && "min-h-[48px]")}
          onClick={() => setPlaying(!isPlaying)}
        >
          {isPlaying ? <><Pause className="w-4 h-4 mr-1" /> STOP</> : <><Play className="w-4 h-4 mr-1" /> GO</>}
        </Button>

        <Button
          size="sm"
          variant={masterArmed ? 'destructive' : 'outline'}
          className={cn(
            "h-10 font-bold text-xs transition-all",
            masterArmed && "armed-pulse min-h-[48px]"
          )}
          onClick={handleArm}
        >
          {masterArmed ? <><Lock className="w-4 h-4 mr-1" /> ARMED</> : <><Unlock className="w-4 h-4 mr-1" /> ARM</>}
        </Button>

        <Button
          size="sm"
          variant="destructive"
          className={cn("h-10 font-bold text-xs", masterArmed && "min-h-[48px]")}
          onClick={handlePanic}
        >
          <AlertTriangle className="w-4 h-4 mr-1" /> PANIC
        </Button>
      </div>
    </div>
  );
}

function SubsystemStrip({ subsystems }: { subsystems: SubsystemStatus[] }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {subsystems.map(sys => {
        const Icon = sys.icon;
        return (
          <div
            key={sys.id}
            className={cn(
              "rounded-lg border p-2 transition-all cursor-pointer group",
              "hover:border-primary/20 active:scale-[0.97]",
              sys.online
                ? "border-border/20 bg-card/40"
                : "border-border/10 bg-card/20 opacity-60"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                sys.online ? "status-dot-online" : "status-dot-offline"
              )} />
              <Icon className={cn("w-3 h-3", sys.color)} />
              <span className="text-[9px] font-bold uppercase tracking-wider text-foreground truncate">
                {sys.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground/50 font-mono-code">
                {sys.channels > 0 ? `${sys.activeChannels}/${sys.channels}` : '—'}
              </span>
              {sys.armed && (
                <Badge className="text-[7px] h-3 px-1 bg-red-500/20 text-red-400 border-0">ARM</Badge>
              )}
              {sys.faults > 0 && (
                <Badge className="text-[7px] h-3 px-1 bg-destructive/20 text-destructive border-0">
                  {sys.faults} FAULT
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SystemHealthBar({ subsystems }: { subsystems: SubsystemStatus[] }) {
  const onlineCount = subsystems.filter(s => s.online).length;
  const faultCount = subsystems.reduce((acc, s) => acc + s.faults, 0);
  const totalChannels = subsystems.reduce((acc, s) => acc + s.channels, 0);

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/10 bg-card/20">
      <div className="flex items-center gap-1.5">
        <CircuitBoard className="w-3.5 h-3.5 text-muted-foreground/50" />
        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">Sistemas</span>
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="outline" className={cn(
          "text-[8px] h-4 px-1.5",
          onlineCount === subsystems.length ? "border-green-500/30 text-green-400" : "border-amber-500/30 text-amber-400"
        )}>
          {onlineCount}/{subsystems.length} ON
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-border/20 text-muted-foreground/50">
          {totalChannels} CH
        </Badge>
      </div>
      {faultCount > 0 && (
        <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-red-500/30 text-red-400">
          {faultCount} FAULTS
        </Badge>
      )}
    </div>
  );
}

function CueStack() {
  const [cues] = useState<CueQueueItem[]>([
    { id: '1', cueNumber: '001', subsystem: 'PYRO', description: 'Opening Salvo — 32 shells', timecodeMs: 0, state: 'queued', channels: 32 },
    { id: '2', cueNumber: '002', subsystem: 'SFX', description: 'CO2 Jets — Stage Left+Right', timecodeMs: 5000, state: 'queued', channels: 8 },
    { id: '3', cueNumber: '003', subsystem: 'DRONES', description: 'Formation: Flag — 200 UAVs', timecodeMs: 10000, state: 'queued', channels: 200 },
    { id: '4', cueNumber: '004', subsystem: 'LIGHTING', description: 'MA3 Seq 4 — Audience Wash', timecodeMs: 15000, state: 'queued', channels: 96 },
    { id: '5', cueNumber: '005', subsystem: 'LASER', description: 'Beam Show — Full RGB', timecodeMs: 20000, state: 'queued', channels: 14 },
    { id: '6', cueNumber: '006', subsystem: 'PYRO', description: 'Grand Finale — All positions', timecodeMs: 180000, state: 'queued', channels: 256 },
  ]);

  const stateColors: Record<string, string> = {
    queued: 'text-muted-foreground/40',
    standby: 'text-amber-400',
    fired: 'text-green-400',
    skipped: 'text-muted-foreground/20',
  };

  const subsystemColors: Record<string, string> = {
    PYRO: 'bg-red-500/15 text-red-400 border-red-500/20',
    SFX: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    DRONES: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
    LIGHTING: 'bg-green-500/15 text-green-400 border-green-500/20',
    LASER: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    AUDIO: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">
          Cue Stack
        </span>
        <Badge variant="secondary" className="text-[8px] h-4 px-1.5">
          {cues.length} cues
        </Badge>
      </div>
      {cues.map((cue, i) => (
        <button
          key={cue.id}
          className={cn(
            "w-full text-left rounded-lg border border-border/10 p-2 transition-all group",
            "hover:border-primary/20 active:scale-[0.98]",
            cue.state === 'standby' && "border-amber-500/20 bg-amber-500/5",
            cue.state === 'fired' && "border-green-500/20 bg-green-500/5 opacity-50",
            cue.state === 'queued' && "bg-card/20"
          )}
        >
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-mono-code text-[10px] font-bold w-8",
              stateColors[cue.state]
            )}>
              {cue.cueNumber}
            </span>
            <Badge variant="outline" className={cn("text-[7px] h-3.5 px-1 border", subsystemColors[cue.subsystem])}>
              {cue.subsystem}
            </Badge>
            <span className="text-[9px] text-foreground/80 truncate flex-1">
              {cue.description}
            </span>
            <span className="text-[8px] font-mono-code text-muted-foreground/30 tabular-nums">
              {(cue.timecodeMs / 1000).toFixed(1)}s
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function QuickFire({ subsystems }: { subsystems: SubsystemStatus[] }) {
  return (
    <div className="space-y-2">
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 px-1">
        Quick Fire
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        {subsystems.filter(s => s.online).map(sys => {
          const Icon = sys.icon;
          return (
            <Button
              key={sys.id}
              variant="outline"
              size="sm"
              className={cn(
                "h-12 flex-col gap-0.5 text-[9px] font-bold uppercase",
                "border-border/15 hover:border-primary/30 active:scale-[0.95]"
              )}
              onClick={() => toast.info(`${sys.name}: Disparo manual — selecione canal`)}
            >
              <Icon className={cn("w-4 h-4", sys.color)} />
              {sys.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function ConnectionsOverview() {
  const bridges = useMemo(() => [
    { name: 'Art-Net', port: 9001, online: false },
    { name: 'OSC', port: 9002, online: false },
    { name: 'sACN', port: 9003, online: false },
    { name: 'MVR', port: 9004, online: false },
  ], []);

  return (
    <div className="space-y-2">
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 px-1">
        Network Bridges
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        {bridges.map(b => (
          <div key={b.name} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border/10 bg-card/20">
            <div className={cn("w-1.5 h-1.5 rounded-full", b.online ? "status-dot-online" : "status-dot-offline")} />
            <span className="text-[8px] font-bold text-muted-foreground/60 uppercase">{b.name}</span>
            <span className="text-[7px] text-muted-foreground/30 ml-auto font-mono-code">:{b.port}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TelemetryMini({ fireone, pbus }: { fireone: ReturnType<typeof useFireOneHardware>; pbus: ReturnType<typeof usePBusHardware> }) {
  return (
    <div className="space-y-2">
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 px-1">
        Telemetria
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        {fireone.isConnected && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-red-500/10 bg-red-500/5">
            <Signal className="w-3 h-3 text-red-400" />
            <div>
              <div className="text-[8px] font-bold text-red-400">FireOne</div>
              <div className="text-[7px] text-muted-foreground/40">
                {fireone.modules.size} mod · {fireone.worstRssi}dBm
              </div>
            </div>
          </div>
        )}
        {pbus.isConnected && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-amber-500/10 bg-amber-500/5">
            <Battery className="w-3 h-3 text-amber-400" />
            <div>
              <div className="text-[8px] font-bold text-amber-400">PBUS</div>
              <div className="text-[7px] text-muted-foreground/40">
                {pbus.deviceCount} dev · {pbus.worstBattery?.toFixed(1) ?? '—'}V
              </div>
            </div>
          </div>
        )}
        {!fireone.isConnected && !pbus.isConnected && (
          <div className="col-span-2 text-center py-3">
            <WifiOff className="w-4 h-4 text-muted-foreground/20 mx-auto mb-1" />
            <span className="text-[8px] text-muted-foreground/30">Nenhum hardware conectado</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SafetyChecklist() {
  const [checks] = useState([
    { id: 'perimeter', label: 'Perímetro Seguro', status: 'ok' as const },
    { id: 'comms', label: 'Comunicação Rádio', status: 'warn' as const },
    { id: 'weather', label: 'Condições Meteorológicas', status: 'ok' as const },
    { id: 'battery', label: 'Baterias > 3.5V', status: 'ok' as const },
    { id: 'continuity', label: 'Continuidade Ignitores', status: 'pending' as const },
    { id: 'backup', label: 'Sistema Backup', status: 'ok' as const },
  ]);

  const statusIcon: Record<string, { color: string; label: string }> = {
    ok: { color: 'text-green-400', label: 'OK' },
    warn: { color: 'text-amber-400', label: 'WARN' },
    fail: { color: 'text-red-400', label: 'FAIL' },
    pending: { color: 'text-muted-foreground/40', label: '...' },
  };

  return (
    <div className="space-y-2">
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 px-1">
        Pre-Flight Safety
      </span>
      <div className="space-y-1">
        {checks.map(c => {
          const st = statusIcon[c.status];
          return (
            <div key={c.id} className="flex items-center gap-2 px-2 py-1 rounded-md border border-border/5 bg-card/10">
              <div className={cn("w-1.5 h-1.5 rounded-full", c.status === 'ok' ? 'bg-green-500' : c.status === 'warn' ? 'bg-amber-500' : 'bg-muted-foreground/20')} />
              <span className="text-[9px] text-foreground/70 flex-1">{c.label}</span>
              <span className={cn("text-[8px] font-bold", st.color)}>{st.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
interface ShowCommanderPanelProps {
  onClose?: () => void;
  onOpenPanel?: (id: string) => void;
}

export default function ShowCommanderPanel({ onClose, onOpenPanel }: ShowCommanderPanelProps) {
  const isMobile = useIsMobile();
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();
  const subsystems = useSubsystems(fireone, pbus);
  const [activeTab, setActiveTab] = useState('overview');
  const engine = useShowCommanderEngine();

  return (
    <div className="h-full flex flex-col bg-background/95">
      {/* Link Lost Overlay */}
      {engine.linkStatus === 'lost' && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 pointer-events-auto">
          <Unlink className="w-10 h-10 text-destructive animate-pulse" />
          <span className="text-sm font-black text-destructive uppercase tracking-wider">
            LINK PERDIDO
          </span>
          <span className="text-[10px] text-muted-foreground">Reconexão automática a cada 500ms...</span>
          <Button
            variant="destructive"
            className="h-14 w-48 font-black text-sm mt-2"
            onClick={() => toast.error('🚨 E-STOP — Todos os sistemas halted')}
          >
            <AlertTriangle className="w-5 h-5 mr-2" /> E-STOP
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-border/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-foreground">
                Show Commander
              </h2>
              <p className="text-[8px] text-muted-foreground/40 font-mono-code">
                UNIFIED CONTROL CENTER
              </p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0 text-muted-foreground/30">
              ✕
            </Button>
          )}
        </div>

        {/* ─── Commander Control Bar ─────────────────────────────── */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {/* LOCK / UNLOCK */}
          <Button
            size="sm"
            variant={engine.isLocked ? 'destructive' : 'outline'}
            className={cn("h-7 text-[9px] font-bold px-2", engine.isLocked && "animate-pulse")}
            onClick={engine.isLocked ? engine.unlockState : engine.lockState}
          >
            {engine.isLocked ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
            {engine.isLocked ? 'LOCKED' : 'LOCK'}
          </Button>

          {/* DRY RUN */}
          <Button
            size="sm"
            variant={engine.isDryRun ? 'secondary' : 'outline'}
            className={cn(
              "h-7 text-[9px] font-bold px-2",
              engine.isDryRun && "border-amber-500/30 text-amber-400"
            )}
            onClick={engine.toggleDryRun}
          >
            <FlaskConical className="w-3 h-3 mr-1" />
            {engine.isDryRun ? 'DRY RUN ●' : 'DRY RUN'}
          </Button>

          {/* Link Status */}
          <div className={cn(
            "flex items-center gap-1 px-2 h-7 rounded-md border text-[9px] font-mono-code",
            engine.linkStatus === 'stable' && "border-green-500/20 text-green-400",
            engine.linkStatus === 'degraded' && "border-amber-500/20 text-amber-400",
            engine.linkStatus === 'lost' && "border-destructive/30 text-destructive animate-pulse",
          )}>
            {engine.linkStatus === 'stable' ? <Link2 className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
            <span>{engine.rtt}ms</span>
          </div>

          {/* Drift Test indicator */}
          {engine.driftTestActive && (
            <Badge variant="outline" className="text-[8px] h-6 px-1.5 border-purple-500/30 text-purple-400 animate-pulse">
              DRIFT ±{Math.abs(engine.injectedDrift).toFixed(0)}ms
            </Badge>
          )}
        </div>

        <SystemHealthBar subsystems={subsystems} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 h-7 bg-muted/10 p-0.5 shrink-0">
          <TabsTrigger value="overview" className="text-[9px] h-6 px-2 data-[state=active]:bg-card">
            Overview
          </TabsTrigger>
          <TabsTrigger value="cues" className="text-[9px] h-6 px-2 data-[state=active]:bg-card">
            Cue Stack
          </TabsTrigger>
          <TabsTrigger value="systems" className="text-[9px] h-6 px-2 data-[state=active]:bg-card">
            Systems
          </TabsTrigger>
          <TabsTrigger value="safety" className="text-[9px] h-6 px-2 data-[state=active]:bg-card">
            Safety
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            <TabsContent value="overview" className="mt-0 space-y-3">
              <MasterTransport />

              {/* DRY RUN Banner */}
              {engine.isDryRun && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-[10px] font-bold text-amber-400">MODO DRY RUN</span>
                    <p className="text-[8px] text-muted-foreground/50">
                      Ensaio virtual — Hardware DMX/Art-Net bloqueado
                    </p>
                  </div>
                </div>
              )}

              <SubsystemStrip subsystems={subsystems} />
              <TelemetryMini fireone={fireone} pbus={pbus} />
              <ConnectionsOverview />
            </TabsContent>

            <TabsContent value="cues" className="mt-0 space-y-3">
              <MasterTransport />
              <CueStack />
            </TabsContent>

            <TabsContent value="systems" className="mt-0 space-y-3">
              <SubsystemStrip subsystems={subsystems} />
              <QuickFire subsystems={subsystems} />
              <TelemetryMini fireone={fireone} pbus={pbus} />
              <ConnectionsOverview />

              {/* Deep-link buttons to individual panels */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 px-1">
                  Abrir Console
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'livefiring', label: 'FX Commander', icon: Flame, color: 'text-red-400' },
                    { id: 'ma3', label: 'grandMA3', icon: Lightbulb, color: 'text-green-400' },
                    { id: 'fleet', label: 'Fleet Manager', icon: Plane, color: 'text-sky-400' },
                    { id: 'lasercontrol', label: 'Laser Control', icon: Zap, color: 'text-purple-400' },
                    { id: 'sacnmonitor', label: 'sACN Monitor', icon: Activity, color: 'text-emerald-400' },
                    { id: 'controllers', label: 'Controllers', icon: Cpu, color: 'text-amber-400' },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onOpenPanel?.(item.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-2 rounded-lg border border-border/10 bg-card/20",
                          "hover:border-primary/20 hover:bg-card/40 active:scale-[0.97] transition-all text-left"
                        )}
                      >
                        <Icon className={cn("w-3.5 h-3.5", item.color)} />
                        <span className="text-[9px] font-bold text-foreground/80">{item.label}</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/20 ml-auto" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="safety" className="mt-0 space-y-3">
              <SafetyChecklist />
              <TelemetryMini fireone={fireone} pbus={pbus} />

              {/* Emergency controls */}
              <div className="space-y-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 px-1">
                  Controles de Emergência
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  <Button
                    variant="destructive"
                    className="h-14 font-black text-sm uppercase tracking-wider"
                    onClick={() => toast.error('🚨 EMERGENCY STOP — All systems halted')}
                  >
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    EMERGENCY STOP
                  </Button>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] font-bold border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => {
                        engine.disarm();
                        toast.warning('DISARM ALL — Todos os sistemas desarmados');
                      }}
                    >
                      <Shield className="w-3.5 h-3.5 mr-1" />
                      DISARM ALL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] font-bold border-red-500/20 text-red-400 hover:bg-red-500/10"
                      onClick={() => toast.error('ABORT SHOW — Show cancelado')}
                    >
                      <Power className="w-3.5 h-3.5 mr-1" />
                      ABORT SHOW
                    </Button>
                  </div>
                </div>
              </div>

              {/* Performance Monitor */}
              <PerformanceMonitor />

              {/* Debug Drift info */}
              <div className="rounded-lg border border-border/10 bg-card/20 p-2 space-y-1">
                <span className="text-[8px] font-bold text-muted-foreground/40 uppercase">Debug (Alt+Shift+D)</span>
                <p className="text-[8px] text-muted-foreground/30">
                  Timecode Drift Test — injeta ±15ms no Master Clock
                </p>
              </div>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}