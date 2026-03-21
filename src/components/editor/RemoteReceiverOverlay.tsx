/**
 * RemoteReceiverOverlay — Desktop overlay for remote sessions.
 * Shows session code, connected slaves, executes commands via shared engine.
 * Bridges hardware commands to FireOne/PBUS/Radio stores with REAL integration.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Smartphone, X, Copy, Wifi, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  generateSessionCode,
  createRemoteSession,
  executeRemoteCommand,
  DEFAULT_PERMISSIONS,
  type RemoteSession,
  type RemoteDevice,
  type RemoteState,
  type HardwareCommandPayload,
  type RemotePermissions,
  type HardwareStatus,
} from '@/lib/remoteCommandEngine';
import { useProjectStore } from '@/store/useProjectStore';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useUndoStore } from '@/store/useUndoStore';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';

interface RemoteReceiverOverlayProps {
  onOpenPanel?: (id: string) => void;
}

export default function RemoteReceiverOverlay({ onOpenPanel }: RemoteReceiverOverlayProps) {
  const [active, setActive] = useState(false);
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [code, setCode] = useState('');
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [log, setLog] = useState<{ action: string; ts: number }[]>([]);
  const [permissions] = useState<RemotePermissions>(DEFAULT_PERMISSIONS);
  const stateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Real hardware hooks ────────────────────────── */
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();

  /* ── Hardware command bridge — routes to REAL hardware ── */
  const handleHardwareCommand = useCallback(async (payload: HardwareCommandPayload) => {
    const label = `${payload.target}:${payload.action}${payload.moduleAddr != null ? `:M${payload.moduleAddr}` : ''}`;

    try {
      switch (payload.target) {
        case 'fireone': {
          switch (payload.action) {
            case 'arm':
              if (payload.moduleAddr != null) await fireone.armModule(payload.moduleAddr);
              break;
            case 'arm-all':
              await fireone.armAll();
              break;
            case 'disarm':
              if (payload.moduleAddr != null) await fireone.disarmModule(payload.moduleAddr);
              break;
            case 'disarm-all':
              await fireone.disarmAll();
              break;
            case 'fire':
              if (payload.moduleAddr != null && payload.cuePosition != null) {
                await fireone.fireIgniter(payload.moduleAddr, payload.cuePosition, payload.duration ?? 500);
              }
              break;
            case 'continuity':
              if (payload.moduleAddr != null) await fireone.requestContinuity(payload.moduleAddr);
              break;
            case 'scan':
              await fireone.discoverModules();
              break;
            case 'estop':
              await fireone.emergencyStop();
              break;
          }
          break;
        }

        case 'pbus': {
          switch (payload.action) {
            case 'arm':
              if (payload.moduleAddr != null) await pbus.armDevice(payload.moduleAddr);
              break;
            case 'arm-all':
              await pbus.armAll();
              break;
            case 'disarm':
              if (payload.moduleAddr != null) await pbus.disarmDevice(payload.moduleAddr);
              break;
            case 'disarm-all':
              await pbus.disarmAll();
              break;
            case 'fire':
              if (payload.moduleAddr != null && payload.cuePosition != null) {
                await pbus.fireCue(payload.moduleAddr, payload.cuePosition, payload.duration ?? 500);
              }
              break;
            case 'continuity':
              if (payload.moduleAddr != null) await pbus.requestCueStatus(payload.moduleAddr);
              break;
            case 'scan':
              await pbus.discoverDevices();
              break;
            case 'estop':
              await pbus.emergencyStop();
              break;
          }
          break;
        }

        case 'radio': {
          // Radio commands are handled transparently by FireOne/PBUS hooks
          // via their built-in radio fallback paths
          if (payload.action === 'estop') {
            await fireone.emergencyStop();
            await pbus.emergencyStop();
          }
          break;
        }
      }

      toast.info(`🔧 HW OK: ${label}`);
    } catch (err: any) {
      toast.error(`❌ HW fail: ${label} — ${err?.message || 'unknown'}`);
    }
  }, [fireone, pbus]);

  /* ── Listen for 'remote-hardware' events from other components ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<HardwareCommandPayload>).detail;
      if (detail) handleHardwareCommand(detail);
    };
    window.addEventListener('remote-hardware', handler);
    return () => window.removeEventListener('remote-hardware', handler);
  }, [handleHardwareCommand]);

  /* ── Build real hardware status for state sync ── */
  const getHardwareStatus = useCallback((): HardwareStatus => {
    let fireoneArmed = 0;
    fireone.modules.forEach(m => { if (m.armed) fireoneArmed++; });

    let pbusArmed = 0;
    let batterySum = 0;
    let batteryCount = 0;
    pbus.devices.forEach(d => {
      if (d.armed) pbusArmed++;
      if (d.batteryV > 0) { batterySum += d.batteryV; batteryCount++; }
    });

    const paths: ('usb' | 'radio' | 'pbus')[] = [];
    if (fireone.connectionPath === 'wired') paths.push('usb');
    if (fireone.connectionPath === 'radio') paths.push('radio');
    if (pbus.connectionPath === 'wired') paths.push('pbus');
    if (pbus.connectionPath === 'radio') paths.push('radio');

    return {
      fireoneModules: fireone.modules.size,
      fireoneArmed,
      pbusDevices: pbus.devices.size,
      pbusArmed,
      radioDevices: 0,
      batteryAvg: batteryCount > 0 ? batterySum / batteryCount : 0,
      connectionPaths: [...new Set(paths)],
    };
  }, [fireone, pbus]);

  const startSession = useCallback(() => {
    const newCode = generateSessionCode();
    setCode(newCode);

    const s = createRemoteSession(newCode, 'receiver', {
      onCommand: (packet) => {
        // Permission check for hardware commands
        if (packet.action === 'hardware') {
          const hw = packet.payload as unknown as HardwareCommandPayload;
          if ((hw.action === 'fire') && !permissions.canFire) {
            toast.error('⛔ Permissão negada: FIRE');
            return;
          }
          if ((hw.action === 'arm' || hw.action === 'arm-all') && !permissions.canArm) {
            toast.error('⛔ Permissão negada: ARM');
            return;
          }
        }

        executeRemoteCommand(packet, {
          projectStore: useProjectStore.getState(),
          sfxStore: useLiveSfxStore.getState(),
          undoStore: useUndoStore.getState(),
          onOpenPanel,
          onHardwareCommand: handleHardwareCommand,
        });
        setLog(prev => [{ action: packet.action, ts: packet.ts }, ...prev].slice(0, 8));
      },
      onPresence: (devs) => {
        setDevices(devs.filter(d => d.role === 'controller'));
      },
    });

    setSession(s);
    setActive(true);

    // State sync every 500ms — includes REAL hardware status
    stateIntervalRef.current = setInterval(() => {
      const store = useProjectStore.getState() as any;
      const state: RemoteState & { ts: number } = {
        currentTime: store.currentTime ?? 0,
        isPlaying: store.isPlaying ?? false,
        activePanel: null,
        duration: store.duration ?? 300,
        selectedCount: store.selectedIds?.length ?? 0,
        hardwareStatus: getHardwareStatus(),
        permissions,
        ts: Date.now(),
      };
      s.sendState(state);
    }, 500);

    toast.success(`📡 Sessão remota: ${newCode}`);
  }, [onOpenPanel, handleHardwareCommand, permissions, getHardwareStatus]);

  const stopSession = useCallback(() => {
    session?.destroy();
    if (stateIntervalRef.current) clearInterval(stateIntervalRef.current);
    setSession(null);
    setActive(false);
    setDevices([]);
    setLog([]);
    setCode('');
  }, [session]);

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
    <>
      {/* ── "Remote Session Active" Banner ── */}
      {controllerCount > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 h-6 bg-destructive/90 flex items-center justify-center gap-2 text-destructive-foreground text-[10px] font-bold">
          <div className="w-2 h-2 rounded-full bg-destructive-foreground animate-pulse" />
          REMOTE SESSION — {controllerCount} slave(s) connected
          <span className="font-mono ml-2">[{code}]</span>
          {fireone.isConnected && <Badge variant="outline" className="text-[7px] h-4 ml-2 border-destructive-foreground/50">FireOne</Badge>}
          {pbus.isConnected && <Badge variant="outline" className="text-[7px] h-4 border-destructive-foreground/50">PBUS</Badge>}
        </div>
      )}

      {/* ── Overlay Widget ── */}
      <div className={cn(
        "fixed bottom-4 right-4 z-40 w-60 rounded-xl border backdrop-blur-md bg-background/90 shadow-lg overflow-hidden",
        controllerCount > 0 && "ring-2 ring-green-500/50"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-green-400" />
            <span className="text-[9px] font-bold uppercase text-foreground">Remote</span>
            {controllerCount > 0 && (
              <Badge variant="default" className="text-[7px] px-1 h-4">{controllerCount}</Badge>
            )}
          </div>
          <Button size="icon" variant="ghost" className="w-5 h-5" onClick={stopSession}>
            <X className="w-3 h-3" />
          </Button>
        </div>

        {/* Code */}
        <div className="px-3 py-2 text-center">
          <p className="text-[8px] text-muted-foreground mb-1">Código:</p>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-2xl font-black tracking-[0.3em] text-primary">{code}</span>
            <button onClick={() => { navigator.clipboard.writeText(code); toast.success('Copiado'); }} className="text-muted-foreground hover:text-foreground">
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[8px] text-muted-foreground mt-1">
            {controllerCount > 0 ? `${controllerCount} slave(s)` : 'Aguardando...'}
          </p>
        </div>

        {/* Hardware Status */}
        {(fireone.isConnected || pbus.isConnected) && (
          <div className="px-3 pb-1 border-t border-border/20 pt-1.5 space-y-0.5">
            <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
              <Shield className="w-2.5 h-2.5" />
              <span className="font-semibold">Hardware:</span>
            </div>
            {fireone.isConnected && (
              <div className="text-[7px] text-muted-foreground/80 pl-3">
                FireOne: {fireone.modules.size} módulos ({fireone.connectionPath})
              </div>
            )}
            {pbus.isConnected && (
              <div className="text-[7px] text-muted-foreground/80 pl-3">
                PBUS: {pbus.devices.size} dispositivos ({pbus.connectionPath})
              </div>
            )}
          </div>
        )}

        {/* Connected Devices */}
        {devices.length > 0 && (
          <div className="px-3 pb-1 space-y-0.5">
            {devices.map(dev => (
              <div key={dev.id} className="flex items-center gap-1.5 text-[8px] text-muted-foreground">
                <Smartphone className="w-2.5 h-2.5 text-primary" />
                <span>{dev.name}</span>
                <span className="font-mono text-[7px] opacity-50">{dev.id.slice(0, 6)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Command log */}
        {log.length > 0 && (
          <div className="px-3 pb-2 space-y-0.5 border-t border-border/20 pt-1.5">
            {log.slice(0, 4).map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-[7px] text-muted-foreground/60">
                <span className="font-mono">{entry.action}</span>
                <span>{new Date(entry.ts).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
