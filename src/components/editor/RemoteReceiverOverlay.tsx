/**
 * RemoteReceiverOverlay — Desktop floating overlay for remote control sessions
 * Shows session code, connected devices, executes incoming commands.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Smartphone, X, Copy, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  generateSessionCode,
  createRemoteSession,
  type RemoteSession,
  type RemoteDevice,
  type CommandPacket,
  type RemoteState,
} from '@/lib/remoteCommandEngine';
import { useProjectStore } from '@/store/useProjectStore';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useUndoStore } from '@/store/useUndoStore';

interface RemoteReceiverOverlayProps {
  onOpenPanel?: (id: string) => void;
}

export default function RemoteReceiverOverlay({ onOpenPanel }: RemoteReceiverOverlayProps) {
  const [active, setActive] = useState(false);
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [code, setCode] = useState('');
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [log, setLog] = useState<{ action: string; ts: number }[]>([]);
  const stateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSession = useCallback(() => {
    const newCode = generateSessionCode();
    setCode(newCode);

    const s = createRemoteSession(newCode, 'receiver', {
      onCommand: (packet: CommandPacket) => {
        executeCommand(packet);
        setLog(prev => [{ action: packet.action, ts: packet.ts }, ...prev].slice(0, 8));
      },
      onPresence: (devs) => {
        setDevices(devs.filter(d => d.role === 'controller'));
      },
    });

    setSession(s);
    setActive(true);

    // State sync every 500ms
    stateIntervalRef.current = setInterval(() => {
      const store = useProjectStore.getState();
      const state: RemoteState & { ts: number } = {
        currentTime: (store as any).currentTime ?? 0,
        isPlaying: (store as any).isPlaying ?? false,
        activePanel: null,
        duration: (store as any).duration ?? 300,
        selectedCount: (store as any).selectedIds?.length ?? 0,
        ts: Date.now(),
      };
      s.sendState(state);
    }, 500);

    toast.success(`📡 Sessão remota: ${newCode}`);
  }, []);

  const stopSession = useCallback(() => {
    session?.destroy();
    if (stateIntervalRef.current) clearInterval(stateIntervalRef.current);
    setSession(null);
    setActive(false);
    setDevices([]);
    setLog([]);
    setCode('');
  }, [session]);

  const executeCommand = useCallback((packet: CommandPacket) => {
    const store = useProjectStore.getState() as any;
    const sfx = useLiveSfxStore.getState();
    const undo = useUndoStore.getState();

    switch (packet.action) {
      case 'transport': {
        const { type, delta, time } = packet.payload as any;
        if (type === 'play') store.setPlaying?.(true);
        else if (type === 'pause') store.setPlaying?.(false);
        else if (type === 'stop') { store.setPlaying?.(false); store.setCurrentTime?.(0); }
        else if (type === 'seek') store.setCurrentTime?.((store.currentTime ?? 0) + (delta || 0));
        else if (type === 'seekTo') store.setCurrentTime?.(time ?? 0);
        break;
      }
      case 'panel': {
        const { panelId } = packet.payload as any;
        onOpenPanel?.(panelId);
        break;
      }
      case 'camera': {
        window.dispatchEvent(new CustomEvent('remote-camera', { detail: packet.payload }));
        break;
      }
      case 'effect': {
        const { type: fxType, action: fxAction } = packet.payload as any;
        if (fxAction === 'fire') {
          sfx.fireEffect({
            id: `remote-${Date.now()}`,
            type: fxType,
            position: [0, 0, 0],
            color: '#ffffff',
            intensity: 255,
            startedAt: performance.now(),
            duration: 2000,
          });
        }
        break;
      }
      case 'undo': undo.undo?.(); break;
      case 'redo': undo.redo?.(); break;
      case 'panic': {
        store.setPlaying?.(false);
        sfx.clearAll();
        toast.error('🚨 PANIC remoto — tudo parado');
        break;
      }
    }
  }, [onOpenPanel]);

  useEffect(() => {
    return () => {
      session?.destroy();
      if (stateIntervalRef.current) clearInterval(stateIntervalRef.current);
    };
  }, [session]);

  const controllerCount = devices.length;

  if (!active) {
    return (
      <button
        onClick={startSession}
        className="fixed bottom-4 right-4 z-40 w-10 h-10 rounded-full bg-muted/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-primary/20 transition-colors"
        title="Iniciar sessão remota"
      >
        <Smartphone className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-40 w-56 rounded-xl border backdrop-blur-md bg-background/90 shadow-lg overflow-hidden",
      controllerCount > 0 && "ring-2 ring-green-500/50 animate-pulse"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-1.5">
          <Wifi className="w-3 h-3 text-green-400" />
          <span className="text-[9px] font-bold uppercase text-foreground">Remote</span>
        </div>
        <Button size="icon" variant="ghost" className="w-5 h-5" onClick={stopSession}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Code display */}
      <div className="px-3 py-2 text-center">
        <p className="text-[8px] text-muted-foreground mb-1">Código de sessão:</p>
        <div className="flex items-center justify-center gap-2">
          <span className="font-mono text-2xl font-black tracking-[0.3em] text-primary">{code}</span>
          <button onClick={() => { navigator.clipboard.writeText(code); toast.success('Código copiado'); }} className="text-muted-foreground hover:text-foreground">
            <Copy className="w-3 h-3" />
          </button>
        </div>
        <p className="text-[8px] text-muted-foreground mt-1">
          {controllerCount > 0 ? `${controllerCount} mobile(s) conectado(s)` : 'Aguardando conexão...'}
        </p>
      </div>

      {/* Command log */}
      {log.length > 0 && (
        <div className="px-3 pb-2 space-y-0.5">
          {log.slice(0, 4).map((entry, i) => (
            <div key={i} className="flex items-center justify-between text-[7px] text-muted-foreground/60">
              <span className="font-mono">{entry.action}</span>
              <span>{new Date(entry.ts).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
