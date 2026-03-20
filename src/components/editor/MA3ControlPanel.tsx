/**
 * MA3ControlPanel — grandMA3 Console Integration Panel
 * OSC control, sACN monitoring + DMX bridge, MVR-xchange live sync
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Radio, Wifi, WifiOff, Settings, Play, Pause, Square,
  RefreshCw, SkipForward, ChevronDown, ChevronUp, Zap,
  Activity, Monitor, Link2, Unlink, Download, RotateCcw,
  Gauge, Layers, Signal, Cable, SkipBack, Moon, Sun,
  AlertTriangle, Grid3X3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  getOSCClient,
  buildMA3Command,
  buildMA3ExecutorFader,
  buildMA3ExecutorButton,
  buildMA3CueTrigger,
  buildMA3SequenceGo,
  buildMA3PlaybackControl,
  type OSCMessage,
  type OSCConnectionState,
} from '@/lib/oscEngine';
import { getSACNReceiver, type SACNUniverse, type SACNConnectionState } from '@/lib/sacnEngine';
import { getMVRXchangeClient, type MVRXchangeStation, type MVRXchangeState, type MVRXchangeEvent, type MDNSDiscoveredStation } from '@/lib/mvrXchange';
import SACNMonitorPanel from './SACNMonitorPanel';
import {
  startBridge, stopBridge, isBridgeRunning,
  addMapping, autoMapUniverseToChannels, getMappings, clearMappings,
  type SACNMapping,
} from '@/lib/sacnDmxBridge';
import { useSfxChannelStore } from '@/store/useSfxChannelStore';

interface MA3ControlPanelProps {
  fs?: boolean;
}

interface CueListEntry {
  seq: number;
  cue: string;
  label: string;
  active: boolean;
}

export default function MA3ControlPanel({ fs = false }: MA3ControlPanelProps) {
  // OSC
  const [oscState, setOscState] = useState<OSCConnectionState>('disconnected');
  const [oscHost, setOscHost] = useState('192.168.1.100');
  const [oscPort, setOscPort] = useState('8000');
  const [oscBridgeUrl, setOscBridgeUrl] = useState('ws://localhost:9002');
  const [oscMessages, setOscMessages] = useState<{ dir: 'tx' | 'rx'; addr: string; args: string; time: number }[]>([]);
  const [cmdInput, setCmdInput] = useState('');
  const [faderValues, setFaderValues] = useState<Record<string, number>>({});
  const [execPage, setExecPage] = useState(1);
  const [cueList, setCueList] = useState<CueListEntry[]>([
    { seq: 1, cue: '1', label: 'Intro', active: false },
    { seq: 1, cue: '2', label: 'Verse 1', active: false },
    { seq: 1, cue: '3', label: 'Chorus', active: false },
    { seq: 1, cue: '4', label: 'Bridge', active: false },
    { seq: 1, cue: '5', label: 'Finale', active: false },
  ]);

  // sACN
  const [sacnState, setSacnState] = useState<SACNConnectionState>('disconnected');
  const [sacnBridgeUrl, setSacnBridgeUrl] = useState('ws://localhost:9003');
  const [sacnUniverses, setSacnUniverses] = useState<SACNUniverse[]>([]);
  const [sacnSubscribeInput, setSacnSubscribeInput] = useState('1');
  const [bridgeEnabled, setBridgeEnabled] = useState(false);
  const [expandedUniverse, setExpandedUniverse] = useState<number | null>(null);

  // MVR-xchange
  const [mvrState, setMvrState] = useState<MVRXchangeState>('disconnected');
  const [mvrBridgeUrl, setMvrBridgeUrl] = useState('ws://localhost:9004');
  const [mvrStations, setMvrStations] = useState<MVRXchangeStation[]>([]);
  const [mvrCommitLog, setMvrCommitLog] = useState<{ station: string; file: string; time: number }[]>([]);
  const [mdnsStations, setMdnsStations] = useState<MDNSDiscoveredStation[]>([]);
  const [autoConnect, setAutoConnect] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const oscClient = useRef(getOSCClient());
  const sacnReceiver = useRef(getSACNReceiver());
  const mvrClient = useRef(getMVRXchangeClient());
  const sfxChannels = useSfxChannelStore(s => s.channels);

  // OSC listener — bidirectional fader sync + cue feedback
  useEffect(() => {
    const unsub = oscClient.current.on((msg: OSCMessage) => {
      const argStr = msg.args.map(a => `${a.type}:${a.value}`).join(', ');
      setOscMessages(prev => [...prev.slice(-99), { dir: 'rx', addr: msg.address, args: argStr, time: Date.now() }]);

      // Bidirectional fader sync: /gma3/exec/{page}.{fader}
      const faderMatch = msg.address.match(/\/gma3\/exec\/(\d+)\.(\d+)/);
      if (faderMatch && msg.args.length > 0) {
        const key = `${faderMatch[1]}.${faderMatch[2]}`;
        const val = typeof msg.args[0].value === 'number' ? msg.args[0].value : parseFloat(String(msg.args[0].value));
        if (!isNaN(val)) {
          setFaderValues(prev => ({ ...prev, [key]: Math.min(1, Math.max(0, val)) }));
        }
      }

      // Cue feedback: /gma3/seq/{seq}/cue
      const cueMatch = msg.address.match(/\/gma3\/seq\/(\d+)\/cue/);
      if (cueMatch && msg.args.length > 0) {
        const seq = parseInt(cueMatch[1]);
        const activeCue = String(msg.args[0].value);
        setCueList(prev => prev.map(c =>
          c.seq === seq ? { ...c, active: c.cue === activeCue } : c
        ));
      }
    });
    return unsub;
  }, []);

  // sACN universe refresh
  useEffect(() => {
    if (sacnState !== 'connected') return;
    const interval = setInterval(() => {
      setSacnUniverses(sacnReceiver.current.subscribedUniverses.map(u => ({ ...u })));
    }, 500);
    return () => clearInterval(interval);
  }, [sacnState]);

  // Bridge toggle
  useEffect(() => {
    if (bridgeEnabled && sacnState === 'connected') {
      startBridge();
    } else {
      stopBridge();
    }
    return () => { stopBridge(); };
  }, [bridgeEnabled, sacnState]);

  // MVR-xchange listener
  useEffect(() => {
    const unsub = mvrClient.current.on((ev: MVRXchangeEvent) => {
      switch (ev.type) {
        case 'state-changed':
          setMvrState(ev.state);
          break;
        case 'station-joined':
          setMvrStations(mvrClient.current.discoveredStations);
          toast.info(`MVR: ${ev.station.name} joined (${ev.station.provider})`);
          break;
        case 'station-left':
          setMvrStations(mvrClient.current.discoveredStations);
          break;
        case 'commit-received':
          setMvrCommitLog(prev => [...prev.slice(-49), {
            station: ev.station.name,
            file: ev.commit.fileName,
            time: ev.commit.timestamp,
          }]);
          toast.success(`MVR commit from ${ev.station.name}: ${ev.commit.fileName}`);
          break;
        case 'fixtures-updated':
          toast.success(`MVR: ${ev.fixtures.length} fixtures synced from ${ev.source}`);
          break;
        case 'mdns-discovered':
          setMdnsStations(prev => {
            const exists = prev.find(s => s.uuid === ev.station.uuid);
            if (exists) return prev.map(s => s.uuid === ev.station.uuid ? ev.station : s);
            return [...prev, ev.station];
          });
          if (autoConnect && mvrState === 'connected') {
            mvrClient.current.connectStation(ev.station.uuid);
          }
          break;
      }
    });
    return unsub;
  }, [autoConnect, mvrState]);

  // ─── OSC Actions ────────────────────────────────────
  const connectOSC = useCallback(async () => {
    try {
      oscClient.current.updateConfig({
        host: oscHost,
        txPort: parseInt(oscPort),
        bridgeUrl: oscBridgeUrl,
      });
      await oscClient.current.connect();
      setOscState('connected');
      toast.success('OSC connected to MA3');
    } catch {
      setOscState('error');
      toast.error('OSC connection failed — check bridge');
    }
  }, [oscHost, oscPort, oscBridgeUrl]);

  const disconnectOSC = useCallback(() => {
    oscClient.current.disconnect();
    setOscState('disconnected');
  }, []);

  const sendCmd = useCallback(() => {
    if (!cmdInput.trim()) return;
    const msg = buildMA3Command(cmdInput.trim());
    oscClient.current.send(msg);
    setOscMessages(prev => [...prev.slice(-99), { dir: 'tx', addr: msg.address, args: cmdInput, time: Date.now() }]);
    setCmdInput('');
  }, [cmdInput]);

  const sendFader = useCallback((page: number, fader: number, value: number) => {
    const key = `${page}.${fader}`;
    setFaderValues(prev => ({ ...prev, [key]: value }));
    oscClient.current.send(buildMA3ExecutorFader(page, fader, value));
  }, []);

  const sendGo = useCallback((seq: number) => {
    oscClient.current.send(buildMA3SequenceGo(seq));
    toast.info(`Seq ${seq} GO`);
  }, []);

  const sendMacro = useCallback((cmd: string, label: string) => {
    oscClient.current.send(buildMA3Command(cmd));
    setOscMessages(prev => [...prev.slice(-99), { dir: 'tx', addr: '/gma3/cmd', args: cmd, time: Date.now() }]);
    toast.info(`MA3: ${label}`);
  }, []);

  // ─── sACN Actions ──────────────────────────────────
  const connectSACN = useCallback(async () => {
    try {
      sacnReceiver.current = getSACNReceiver();
      await sacnReceiver.current.connect();
      setSacnState('connected');
      toast.success('sACN receiver connected');
    } catch {
      setSacnState('error');
      toast.error('sACN connection failed');
    }
  }, [sacnBridgeUrl]);

  const disconnectSACN = useCallback(() => {
    sacnReceiver.current.disconnect();
    setSacnState('disconnected');
    setSacnUniverses([]);
    stopBridge();
    setBridgeEnabled(false);
  }, []);

  const subscribeSACN = useCallback(() => {
    const unis = sacnSubscribeInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
    if (unis.length === 0) return;
    sacnReceiver.current.subscribe(unis);
    toast.info(`Subscribed to sACN universe(s): ${unis.join(', ')}`);
  }, [sacnSubscribeInput]);

  const handleAutoMap = useCallback((universe: number) => {
    const count = autoMapUniverseToChannels(universe);
    toast.success(`Auto-mapped ${count} SFX channels to sACN universe ${universe}`);
  }, []);

  // ─── MVR-xchange Actions ───────────────────────────
  const connectMVR = useCallback(async () => {
    try {
      await mvrClient.current.connect();
      toast.success('MVR-xchange connected');
    } catch {
      toast.error('MVR-xchange connection failed');
    }
  }, []);

  const disconnectMVR = useCallback(() => {
    mvrClient.current.disconnect();
    setMvrStations([]);
  }, []);

  // ─── Render ────────────────────────────────────────
  const stateColor = (s: string) => {
    switch (s) {
      case 'connected': return 'text-emerald-400';
      case 'connecting': case 'discovering': case 'syncing': return 'text-amber-400';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground/40';
    }
  };

  return (
    <div className={cn("flex flex-col h-full", fs ? "p-3" : "p-2")} style={{ background: 'hsl(220 15% 6%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className={cn("font-black uppercase tracking-wider text-foreground", fs ? "text-sm" : "text-[10px]")}>
            grandMA3
          </h3>
          <p className={cn("text-muted-foreground/50", fs ? "text-[10px]" : "text-[8px]")}>
            OSC · sACN · MVR-xchange
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className={cn("text-[7px] h-4 px-1", stateColor(oscState))}>
            OSC {oscState === 'connected' ? '●' : '○'}
          </Badge>
          <Badge variant="outline" className={cn("text-[7px] h-4 px-1", stateColor(sacnState))}>
            sACN {sacnState === 'connected' ? '●' : '○'}
          </Badge>
          <Badge variant="outline" className={cn("text-[7px] h-4 px-1", stateColor(mvrState))}>
            MVR {mvrState === 'connected' ? '●' : '○'}
          </Badge>
          {bridgeEnabled && (
            <Badge variant="outline" className="text-[7px] h-4 px-1 text-amber-400 border-amber-500/30">
              BRIDGE ●
            </Badge>
          )}
          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setShowSettings(s => !s)}>
            <Settings className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Settings (collapsible) */}
      {showSettings && (
        <div className="space-y-2 mb-2 p-2 rounded border border-border/20 bg-background/30 text-[9px]">
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 items-center">
            <span className="text-muted-foreground/50">MA3 IP</span>
            <Input value={oscHost} onChange={e => setOscHost(e.target.value)} className="h-5 text-[9px]" />
            <span className="text-muted-foreground/50">OSC Port</span>
            <Input value={oscPort} onChange={e => setOscPort(e.target.value)} className="h-5 text-[9px]" />
            <span className="text-muted-foreground/50">OSC Bridge</span>
            <Input value={oscBridgeUrl} onChange={e => setOscBridgeUrl(e.target.value)} className="h-5 text-[9px]" />
            <span className="text-muted-foreground/50">sACN Bridge</span>
            <Input value={sacnBridgeUrl} onChange={e => setSacnBridgeUrl(e.target.value)} className="h-5 text-[9px]" />
            <span className="text-muted-foreground/50">MVR Bridge</span>
            <Input value={mvrBridgeUrl} onChange={e => setMvrBridgeUrl(e.target.value)} className="h-5 text-[9px]" />
          </div>
        </div>
      )}

      <Tabs defaultValue="osc" className="flex-1 flex flex-col">
        <TabsList className="h-7">
          <TabsTrigger value="osc" className="text-[9px] h-5">OSC Control</TabsTrigger>
          <TabsTrigger value="sacn" className="text-[9px] h-5">sACN Bridge</TabsTrigger>
          <TabsTrigger value="mvr" className="text-[9px] h-5">MVR-xchange</TabsTrigger>
          <TabsTrigger value="monitor" className="text-[9px] h-5">Monitor</TabsTrigger>
        </TabsList>

        {/* ═══ OSC Tab ═══ */}
        <TabsContent value="osc" className="flex-1 flex flex-col mt-1 space-y-2">
          {/* Connect bar */}
          <div className="flex items-center gap-1">
            {oscState === 'connected' ? (
              <Button size="sm" variant="outline" className="h-6 text-[8px]" onClick={disconnectOSC}>
                <Unlink className="w-3 h-3 mr-1" /> Disconnect
              </Button>
            ) : (
              <Button size="sm" className="h-6 text-[8px]" onClick={connectOSC}>
                <Link2 className="w-3 h-3 mr-1" /> Connect OSC
              </Button>
            )}
            <span className="text-[7px] text-muted-foreground/40 ml-auto">
              TX:{oscClient.current.stats.tx} RX:{oscClient.current.stats.rx}
            </span>
          </div>

          {/* Command Line */}
          <div className="flex gap-1">
            <Input
              value={cmdInput}
              onChange={e => setCmdInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendCmd()}
              placeholder="MA3 Command (e.g. Go Seq 1)"
              className="h-6 text-[9px] font-mono flex-1"
              disabled={oscState !== 'connected'}
            />
            <Button size="sm" className="h-6 text-[8px] px-2" onClick={sendCmd} disabled={oscState !== 'connected'}>
              Send
            </Button>
          </div>

          {/* MA3 Macro Buttons */}
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" className="h-6 text-[8px] px-2"
              onClick={() => sendMacro('Go+ Seq 1', 'Go+')} disabled={oscState !== 'connected'}>
              <Play className="w-2.5 h-2.5 mr-0.5" /> Go+
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[8px] px-2"
              onClick={() => sendMacro('Go- Seq 1', 'Go-')} disabled={oscState !== 'connected'}>
              <SkipBack className="w-2.5 h-2.5 mr-0.5" /> Go−
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[8px] px-2"
              onClick={() => sendMacro('Pause Seq 1', 'Pause')} disabled={oscState !== 'connected'}>
              <Pause className="w-2.5 h-2.5 mr-0.5" /> Pause
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[8px] px-2 text-amber-400 border-amber-500/30"
              onClick={() => sendMacro('BlackOut', 'Blackout')} disabled={oscState !== 'connected'}>
              <Moon className="w-2.5 h-2.5 mr-0.5" /> BO
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[8px] px-2 text-emerald-400 border-emerald-500/30"
              onClick={() => sendMacro('FullOn', 'Full On')} disabled={oscState !== 'connected'}>
              <Sun className="w-2.5 h-2.5 mr-0.5" /> Full
            </Button>
            <Button size="sm" variant="destructive" className="h-6 text-[8px] px-2"
              onClick={() => sendMacro('Off Executor *.*', '🚨 Panic')} disabled={oscState !== 'connected'}>
              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Panic
            </Button>
          </div>

          {/* Sequence Quick Go */}
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(seq => (
              <Button key={seq} size="sm" variant="outline" className="h-5 text-[7px] px-1.5"
                onClick={() => sendGo(seq)} disabled={oscState !== 'connected'}>
                Seq {seq}
              </Button>
            ))}
          </div>

          {/* Cue List */}
          <div className="text-[8px] font-bold text-muted-foreground/50 uppercase">Cue List — Seq 1</div>
          <ScrollArea className="max-h-24">
            <div className="space-y-0.5">
              {cueList.map((c, i) => (
                <button key={i}
                  onClick={() => {
                    oscClient.current.send(buildMA3CueTrigger(c.seq, parseFloat(c.cue)));
                    setCueList(prev => prev.map((p, j) => ({ ...p, active: j === i })));
                  }}
                  disabled={oscState !== 'connected'}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1 rounded text-[8px] transition-all",
                    c.active
                      ? "bg-primary/15 border border-primary/30 text-foreground"
                      : "bg-background/20 border border-transparent text-muted-foreground/60 hover:bg-background/30"
                  )}>
                  <span className="font-mono w-6 text-right">{c.cue}</span>
                  <span className="flex-1 text-left truncate">{c.label}</span>
                  {c.active && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Executor Faders */}
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-bold text-muted-foreground/50 uppercase">Executor Page</span>
            <Select value={String(execPage)} onValueChange={v => setExecPage(parseInt(v))}>
              <SelectTrigger className="h-5 w-14 text-[8px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                  <SelectItem key={p} value={String(p)} className="text-[9px]">Page {p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(fader => {
              const key = `${execPage}.${fader}`;
              const val = faderValues[key] ?? 0;
              return (
                <div key={fader} className="flex flex-col items-center gap-0.5 p-1 rounded bg-background/20 border border-border/10">
                  <span className="text-[7px] font-mono text-muted-foreground/40">F{fader}</span>
                  <Slider
                    value={[val * 100]}
                    onValueChange={([v]) => sendFader(execPage, fader, v / 100)}
                    max={100} step={1}
                    orientation="vertical"
                    className="h-12"
                    disabled={oscState !== 'connected'}
                  />
                  <span className="text-[7px] font-mono text-foreground/50">{Math.round(val * 100)}%</span>
                </div>
              );
            })}
          </div>

          {/* OSC Log with filter */}
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-bold text-muted-foreground/50 uppercase">OSC Log</span>
            <Input
              placeholder="Filter address..."
              className="h-4 text-[7px] w-24 px-1"
              onChange={e => {
                const f = e.target.value.toLowerCase();
                setOscMessages(prev => prev); // trigger re-render, filter applied below
                (window as any).__oscFilter = f;
              }}
            />
          </div>
          <ScrollArea className="flex-1 max-h-32">
            <div className="space-y-0.5 font-mono">
              {oscMessages.slice(-20).reverse()
                .filter(m => {
                  const f = (window as any).__oscFilter || '';
                  return !f || m.addr.toLowerCase().includes(f);
                })
                .map((m, i) => (
                <div key={i} className={cn("text-[7px] flex gap-1",
                  m.dir === 'tx' ? 'text-blue-400/60' : 'text-emerald-400/60')}>
                  <span className="w-4 shrink-0">{m.dir === 'tx' ? '→' : '←'}</span>
                  <span className="truncate">{m.addr}</span>
                  <span className="text-muted-foreground/30 truncate ml-auto">{m.args}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══ sACN Tab ═══ */}
        <TabsContent value="sacn" className="flex-1 flex flex-col mt-1 space-y-2">
          <div className="flex items-center gap-1">
            {sacnState === 'connected' ? (
              <Button size="sm" variant="outline" className="h-6 text-[8px]" onClick={disconnectSACN}>
                <Unlink className="w-3 h-3 mr-1" /> Disconnect
              </Button>
            ) : (
              <Button size="sm" className="h-6 text-[8px]" onClick={connectSACN}>
                <Link2 className="w-3 h-3 mr-1" /> Connect sACN
              </Button>
            )}
          </div>

          {/* sACN → DMX Bridge Toggle */}
          <div className={cn(
            "flex items-center justify-between p-2 rounded border",
            bridgeEnabled ? "bg-amber-500/10 border-amber-500/30" : "bg-background/20 border-border/15"
          )}>
            <div className="flex items-center gap-1.5">
              <Zap className={cn("w-3 h-3", bridgeEnabled ? "text-amber-400" : "text-muted-foreground/40")} />
              <div>
                <span className="text-[9px] font-bold text-foreground">Route sACN → DMX Engine</span>
                <p className="text-[7px] text-muted-foreground/50">MA3 controla SFX channels em tempo real</p>
              </div>
            </div>
            <Switch checked={bridgeEnabled} onCheckedChange={setBridgeEnabled} className="scale-75"
              disabled={sacnState !== 'connected'} />
          </div>

          {/* Subscribe */}
          <div className="flex gap-1">
            <Input
              value={sacnSubscribeInput}
              onChange={e => setSacnSubscribeInput(e.target.value)}
              placeholder="Universe(s): 1,2,3"
              className="h-6 text-[9px] font-mono flex-1"
              disabled={sacnState !== 'connected'}
            />
            <Button size="sm" className="h-6 text-[8px] px-2" onClick={subscribeSACN} disabled={sacnState !== 'connected'}>
              Subscribe
            </Button>
          </div>

          {/* Universe list */}
          <ScrollArea className="flex-1">
            <div className="space-y-1.5">
              {sacnUniverses.map(u => (
                <div key={u.universe} className="p-1.5 rounded border border-border/15 bg-background/20">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="font-bold text-foreground">Universe {u.universe}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] text-muted-foreground/40">Pri:{u.priority}</span>
                      <span className="text-[8px] text-emerald-400/60">{u.fps}fps</span>
                      <Button size="sm" variant="ghost" className="h-4 text-[7px] px-1"
                        onClick={() => handleAutoMap(u.universe)}>
                        Auto-Map
                      </Button>
                      <Button size="sm" variant="ghost" className="h-4 w-4 p-0"
                        onClick={() => setExpandedUniverse(expandedUniverse === u.universe ? null : u.universe)}>
                        <Grid3X3 className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  </div>
                  {/* Channel bar (first 64 channels) */}
                  <div className="flex gap-px mt-1 h-3">
                    {Array.from({ length: 64 }, (_, i) => {
                      const val = u.channels[i] || 0;
                      return (
                        <div key={i} className="flex-1 rounded-sm" style={{
                          backgroundColor: `hsla(210, 60%, 50%, ${val / 255})`,
                          minWidth: '1px',
                        }} />
                      );
                    })}
                  </div>
                  <div className="text-[7px] text-muted-foreground/30 mt-0.5">
                    Last: {new Date(u.lastUpdate).toLocaleTimeString()} · Seq:{u.sequence} · {u.sourceName}
                  </div>
                  {/* Expanded 512-channel grid */}
                  {expandedUniverse === u.universe && (
                    <div className="mt-2 p-1 rounded border border-border/10 bg-background/10">
                      <div className="text-[7px] font-bold text-muted-foreground/50 mb-1">512 Channels</div>
                      <div className="grid gap-px" style={{ gridTemplateColumns: 'repeat(32, 1fr)' }}>
                        {Array.from({ length: 512 }, (_, i) => {
                          const val = u.channels[i] || 0;
                          return (
                            <div key={i} className="aspect-square rounded-[1px]" style={{
                              backgroundColor: val > 0 ? `hsla(210, 60%, 50%, ${Math.max(0.15, val / 255)})` : 'hsla(220, 10%, 15%, 0.3)',
                            }} title={`Ch ${i + 1}: ${val}`} />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {sacnUniverses.length === 0 && sacnState === 'connected' && (
                <div className="text-center py-6">
                  <Layers className="w-5 h-5 mx-auto text-muted-foreground/20 mb-1" />
                  <p className="text-[9px] text-muted-foreground/40">Subscribe to universes to monitor sACN data</p>
                </div>
              )}
              {sacnState !== 'connected' && (
                <div className="text-center py-6">
                  <Cable className="w-5 h-5 mx-auto text-muted-foreground/20 mb-1" />
                  <p className="text-[9px] text-muted-foreground/40">Connect sACN bridge to receive DMX data from MA3</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Active Mappings */}
          {getMappings().length > 0 && (
            <div className="p-1.5 rounded border border-border/15 bg-background/20">
              <div className="flex items-center justify-between text-[8px] mb-1">
                <span className="font-bold text-muted-foreground/50 uppercase">Active Mappings</span>
                <Button size="sm" variant="ghost" className="h-4 text-[7px] px-1" onClick={() => { clearMappings(); toast.info('Mappings cleared'); }}>
                  Clear
                </Button>
              </div>
              <div className="space-y-0.5">
                {getMappings().slice(0, 8).map((m, i) => {
                  const ch = sfxChannels.find(c => c.id === m.sfxChannelId);
                  return (
                    <div key={i} className="flex items-center gap-1 text-[7px] text-muted-foreground/60">
                      <span>U{m.universe}:{m.startChannel}</span>
                      <span>→</span>
                      <span className="text-foreground/60 truncate">{ch?.name ?? m.sfxChannelId}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═══ MVR-xchange Tab ═══ */}
        <TabsContent value="mvr" className="flex-1 flex flex-col mt-1 space-y-2">
          <div className="flex items-center gap-1">
            {mvrState === 'connected' ? (
              <Button size="sm" variant="outline" className="h-6 text-[8px]" onClick={disconnectMVR}>
                <Unlink className="w-3 h-3 mr-1" /> Disconnect
              </Button>
            ) : (
              <Button size="sm" className="h-6 text-[8px]" onClick={connectMVR}>
                <Link2 className="w-3 h-3 mr-1" /> Connect MVR
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-6 text-[8px] px-2"
              onClick={() => { mvrClient.current.requestDiscovery(); toast.info('Scanning LAN...'); }}
              disabled={mvrState !== 'connected'}>
              <RefreshCw className="w-3 h-3 mr-0.5" /> Scan
            </Button>
            <span className="text-[7px] text-muted-foreground/40 ml-auto">
              {mvrStations.length} station(s)
            </span>
          </div>

          {/* Auto-Connect + mDNS Status */}
          <div className={cn(
            "flex items-center justify-between p-1.5 rounded border",
            autoConnect ? "bg-emerald-500/10 border-emerald-500/20" : "bg-background/20 border-border/15"
          )}>
            <div className="flex items-center gap-1.5">
              <Wifi className={cn("w-3 h-3", mdnsStations.length > 0 ? "text-emerald-400" : "text-muted-foreground/40")} />
              <div>
                <span className="text-[9px] font-bold text-foreground">Auto-Connect mDNS</span>
                <p className="text-[7px] text-muted-foreground/50">
                  {mdnsStations.length > 0
                    ? `${mdnsStations.length} console(s) discovered`
                    : mvrState === 'connected' ? 'Scanning LAN...' : 'Connect to scan'}
                </p>
              </div>
            </div>
            <Switch checked={autoConnect} onCheckedChange={setAutoConnect} className="scale-75" />
          </div>

          {/* mDNS Discovered Consoles */}
          {mdnsStations.length > 0 && (
            <>
              <div className="text-[8px] font-bold text-muted-foreground/50 uppercase">mDNS Discovery</div>
              <div className="space-y-1">
                {mdnsStations.map(s => (
                  <div key={s.uuid} className="flex items-center justify-between p-1.5 rounded border border-border/15 bg-background/20 text-[8px]">
                    <div>
                      <span className="font-bold text-foreground">{s.name}</span>
                      <span className="text-muted-foreground/40 ml-1">{s.ip}:{s.port}</span>
                      {s.provider && <span className="text-muted-foreground/30 ml-1">({s.provider})</span>}
                    </div>
                    <Button size="sm" variant="ghost" className="h-4 text-[7px] px-1.5"
                      onClick={() => { mvrClient.current.connectStation(s.uuid); toast.info(`Connecting to ${s.name}...`); }}>
                      <Link2 className="w-2.5 h-2.5 mr-0.5" /> Connect
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Discovered Stations */}
          <div className="text-[8px] font-bold text-muted-foreground/50 uppercase">Stations</div>
          <ScrollArea className="flex-1">
            <div className="space-y-1">
              {mvrStations.map(station => (
                <div key={station.uuid} className="p-1.5 rounded border border-border/15 bg-background/20">
                  <div className="flex items-center justify-between text-[9px]">
                    <div className="flex items-center gap-1">
                      <Monitor className="w-3 h-3 text-foreground/60" />
                      <span className="font-bold text-foreground">{station.name}</span>
                      {station.isSessionHost && (
                        <Badge variant="outline" className="text-[6px] h-3 px-1 border-amber-500/30 text-amber-400">HOST</Badge>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" className="h-5 text-[7px] px-1.5"
                      onClick={() => { mvrClient.current.requestLatest(station.uuid); toast.info(`Requesting latest from ${station.name}`); }}>
                      <Download className="w-2.5 h-2.5 mr-0.5" /> Sync
                    </Button>
                  </div>
                  <div className="text-[7px] text-muted-foreground/40 mt-0.5">
                    {station.provider} · {station.ip} · {station.commits.length} commits
                  </div>
                </div>
              ))}
              {mvrStations.length === 0 && mvrState === 'connected' && (
                <div className="text-center py-6">
                  <RefreshCw className="w-5 h-5 mx-auto text-muted-foreground/20 mb-1 animate-spin" />
                  <p className="text-[9px] text-muted-foreground/40">Discovering MA3 stations on network...</p>
                </div>
              )}
              {mvrState !== 'connected' && (
                <div className="text-center py-6">
                  <Signal className="w-5 h-5 mx-auto text-muted-foreground/20 mb-1" />
                  <p className="text-[9px] text-muted-foreground/40">Connect to discover grandMA3 consoles via MVR-xchange</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Commit Log */}
          {mvrCommitLog.length > 0 && (
            <>
              <div className="text-[8px] font-bold text-muted-foreground/50 uppercase">Commit Log</div>
              <ScrollArea className="max-h-24">
                <div className="space-y-0.5 font-mono">
                  {mvrCommitLog.slice(-10).reverse().map((c, i) => (
                    <div key={i} className="text-[7px] flex gap-1 text-muted-foreground/50">
                      <span className="text-foreground/40">{new Date(c.time).toLocaleTimeString()}</span>
                      <span className="text-emerald-400/60">{c.station}</span>
                      <span className="truncate">{c.file}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </TabsContent>

        {/* ═══ Monitor Tab ═══ */}
        <TabsContent value="monitor" className="flex-1 flex flex-col mt-1">
          <SACNMonitorPanel compact />
        </TabsContent>
      </Tabs>
    </div>
  );
}
