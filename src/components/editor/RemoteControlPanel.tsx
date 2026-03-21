/**
 * RemoteControlPanel — Mobile controller for real-time PC control
 * Touch-optimized: transport, camera orbit, SFX triggers, panic
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Smartphone, Wifi, WifiOff, AlertTriangle, Flame, Snowflake, Sparkles, Wind, Undo2, Redo2, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import {
  generateSessionCode,
  createRemoteSession,
  type RemoteSession,
  type RemoteState,
  type RemoteDevice,
} from '@/lib/remoteCommandEngine';

interface RemoteControlPanelProps {
  onClose?: () => void;
}

export default function RemoteControlPanel({ onClose }: RemoteControlPanelProps) {
  const [code, setCode] = useState('');
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [connected, setConnected] = useState(false);
  const [remoteState, setRemoteState] = useState<RemoteState | null>(null);
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [latency, setLatency] = useState(0);
  const touchRef = useRef<{ startX: number; startY: number; active: boolean }>({ startX: 0, startY: 0, active: false });
  const throttleRef = useRef(0);

  const handleConnect = useCallback(() => {
    if (!code || code.length !== 6) {
      toast.error('Insira o código de 6 dígitos do desktop');
      return;
    }

    const s = createRemoteSession(code, 'controller', {
      onState: (state) => {
        setRemoteState(state);
        setLatency(Date.now() - (state as any).ts || 0);
      },
      onPresence: (devs) => {
        setDevices(devs);
        const hasReceiver = devs.some(d => d.role === 'receiver');
        if (hasReceiver && !connected) {
          setConnected(true);
          haptics.success();
          toast.success('🔗 Conectado ao desktop!');
        }
      },
    });

    setSession(s);
    setConnected(false);
    toast.info('Conectando...');
  }, [code, connected]);

  const handleDisconnect = useCallback(() => {
    session?.destroy();
    setSession(null);
    setConnected(false);
    setRemoteState(null);
    setDevices([]);
    toast.info('Desconectado');
  }, [session]);

  const send = useCallback((action: any, payload: Record<string, unknown>) => {
    if (!session) return;
    session.sendCommand(action, payload);
    haptics.tap();
  }, [session]);

  // Camera orbit touch handler
  const handleOrbitStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { startX: t.clientX, startY: t.clientY, active: true };
  }, []);

  const handleOrbitMove = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current.active || !session) return;
    const now = Date.now();
    if (now - throttleRef.current < 50) return; // 20fps max
    throttleRef.current = now;

    const t = e.touches[0];
    const dx = (t.clientX - touchRef.current.startX) * 0.5;
    const dy = (t.clientY - touchRef.current.startY) * 0.5;
    touchRef.current.startX = t.clientX;
    touchRef.current.startY = t.clientY;

    send('camera', { type: 'orbit', dx, dy });
  }, [session, send]);

  const handleOrbitEnd = useCallback(() => {
    touchRef.current.active = false;
  }, []);

  useEffect(() => {
    return () => { session?.destroy(); };
  }, [session]);

  const isPlaying = remoteState?.isPlaying ?? false;

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Remote Control</h3>
          </div>
          <Badge variant={connected ? 'default' : 'secondary'} className="text-[9px]">
            {connected ? <><Wifi className="w-3 h-3 mr-1" />Online</> : <><WifiOff className="w-3 h-3 mr-1" />Offline</>}
          </Badge>
        </div>

        {/* Connection */}
        {!session ? (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground">Insira o código exibido no desktop:</p>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="font-mono text-center text-lg tracking-[0.3em] h-12"
                maxLength={6}
              />
              <Button onClick={handleConnect} className="h-12 px-6" disabled={code.length !== 6}>
                Conectar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-muted/30 rounded-lg p-2">
            <div>
              <p className="text-[9px] text-muted-foreground">Sessão: <span className="font-mono text-foreground">{session.code}</span></p>
              <p className="text-[9px] text-muted-foreground">{devices.length} dispositivo(s) · {latency}ms</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleDisconnect} className="h-7 text-[9px]">
              Desconectar
            </Button>
          </div>
        )}

        {/* Transport */}
        {connected && (
          <>
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Transporte</p>
              <div className="flex items-center justify-center gap-3">
                <Button size="icon" variant="outline" className="w-12 h-12 rounded-full" onClick={() => send('transport', { type: 'seek', delta: -5 })}>
                  <SkipBack className="w-5 h-5" />
                </Button>
                <Button size="icon" className={cn("w-16 h-16 rounded-full", isPlaying ? "bg-destructive" : "bg-primary")} onClick={() => send('transport', { type: isPlaying ? 'pause' : 'play' })}>
                  {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                </Button>
                <Button size="icon" variant="outline" className="w-12 h-12 rounded-full" onClick={() => send('transport', { type: 'seek', delta: 5 })}>
                  <SkipForward className="w-5 h-5" />
                </Button>
              </div>

              {/* Seek slider */}
              {remoteState && (
                <div className="px-2">
                  <Slider
                    value={[remoteState.currentTime]}
                    max={remoteState.duration || 300}
                    step={0.1}
                    onValueChange={([v]) => send('transport', { type: 'seekTo', time: v })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[8px] text-muted-foreground mt-1 font-mono">
                    <span>{formatTime(remoteState.currentTime)}</span>
                    <span>{formatTime(remoteState.duration)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Camera Orbit Pad */}
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Câmera 3D</p>
              <div
                className="w-full h-32 bg-muted/20 border border-border/50 rounded-xl flex items-center justify-center touch-none cursor-move relative overflow-hidden"
                onTouchStart={handleOrbitStart}
                onTouchMove={handleOrbitMove}
                onTouchEnd={handleOrbitEnd}
              >
                <Move className="w-8 h-8 text-muted-foreground/30" />
                <span className="absolute bottom-1 text-[8px] text-muted-foreground/40">Arraste para orbitar</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-[9px]" onClick={() => send('camera', { type: 'zoom', delta: -1 })}>
                  Zoom −
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-[9px]" onClick={() => send('camera', { type: 'reset' })}>
                  Reset
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-[9px]" onClick={() => send('camera', { type: 'zoom', delta: 1 })}>
                  Zoom +
                </Button>
              </div>
            </div>

            {/* SFX Triggers */}
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Live FX</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { type: 'flame', icon: Flame, label: 'Flame', color: 'bg-orange-500/20 text-orange-400' },
                  { type: 'co2', icon: Snowflake, label: 'CO₂', color: 'bg-blue-500/20 text-blue-400' },
                  { type: 'spark', icon: Sparkles, label: 'Spark', color: 'bg-yellow-500/20 text-yellow-400' },
                  { type: 'haze', icon: Wind, label: 'Haze', color: 'bg-purple-500/20 text-purple-400' },
                ].map(fx => (
                  <button
                    key={fx.type}
                    className={cn("flex flex-col items-center gap-1 p-3 rounded-xl border border-border/30 active:scale-90 transition-transform", fx.color)}
                    onClick={() => { send('effect', { type: fx.type, action: 'fire' }); haptics.medium(); }}
                  >
                    <fx.icon className="w-6 h-6" />
                    <span className="text-[8px] font-semibold">{fx.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 h-9 text-[9px]" onClick={() => send('undo', {})}>
                <Undo2 className="w-3 h-3 mr-1" /> Undo
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-9 text-[9px]" onClick={() => send('redo', {})}>
                <Redo2 className="w-3 h-3 mr-1" /> Redo
              </Button>
            </div>

            {/* PANIC */}
            <Button
              variant="destructive"
              className="w-full h-14 text-lg font-black uppercase tracking-widest"
              onClick={() => { send('panic', {}); haptics.error(); toast.error('🚨 PANIC — All stop!'); }}
            >
              <AlertTriangle className="w-6 h-6 mr-2" /> PANIC
            </Button>
          </>
        )}
      </div>
    </ScrollArea>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
