/**
 * ConnectionManagerPanel — Unified Connection Hub
 * Manages all hardware connections: FireOne RS-485, PBUS, Art-Net, USB DMX, Radio
 */
import { useState, useCallback } from 'react';
import { Usb, Wifi, WifiOff, Radio, Cable, RefreshCw, Plus, X, Activity, Zap, Signal, ArrowUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { useRadioLink } from '@/hooks/useRadioLink';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ConnectionEntry {
  id: string;
  name: string;
  protocol: string;
  baud?: number;
  port?: string;
  connected: boolean;
  autoReconnect: boolean;
  txBytes: number;
  rxBytes: number;
  latencyMs: number;
  packetLoss: number;
  uptime: number;
}

interface ConnectionManagerPanelProps {
  fs?: boolean;
}

export default function ConnectionManagerPanel({ fs = false }: ConnectionManagerPanelProps) {
  const isMobile = useIsMobile();
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();
  const radioLink = useRadioLink();
  const [autoReconnect, setAutoReconnect] = useState<Record<string, boolean>>({});

  const connections: ConnectionEntry[] = [
    {
      id: 'fireone',
      name: 'FireOne XL4+',
      protocol: 'RS-485',
      baud: 9600,
      connected: fireone.isConnected,
      autoReconnect: autoReconnect['fireone'] ?? false,
      txBytes: fireone.txBytes,
      rxBytes: fireone.rxBytes,
      latencyMs: fireone.lastHeartbeat ? Math.min(999, Date.now() - fireone.lastHeartbeat) : 0,
      packetLoss: 0,
      uptime: fireone.lastHeartbeat ? Date.now() - fireone.lastHeartbeat : 0,
    },
    {
      id: 'pbus',
      name: 'PBUS Network',
      protocol: 'Serial 19200',
      baud: 19200,
      connected: pbus.isConnected,
      autoReconnect: autoReconnect['pbus'] ?? false,
      txBytes: pbus.txBytes,
      rxBytes: pbus.rxBytes,
      latencyMs: 0,
      packetLoss: 0,
      uptime: 0,
    },
    {
      id: 'radio',
      name: 'Radio Antenna',
      protocol: radioLink.dongleProfile?.label || 'USB Radio',
      baud: radioLink.dongleProfile?.baudRate,
      connected: radioLink.isConnected,
      autoReconnect: autoReconnect['radio'] ?? false,
      txBytes: radioLink.packetStats.totalTx * 16,
      rxBytes: radioLink.packetStats.totalRx * 16,
      latencyMs: 0,
      packetLoss: radioLink.packetStats.totalTx > 0 ? Math.round((radioLink.packetStats.ackFailed / radioLink.packetStats.totalTx) * 100) : 0,
      uptime: 0,
    },
  ];

  const handleConnect = useCallback(async (connId: string) => {
    try {
      if (connId === 'fireone') {
        await fireone.connect();
        toast.success('FireOne RS-485 conectado');
        await fireone.discoverModules(20);
      } else if (connId === 'pbus') {
        await pbus.connect();
        toast.success('PBUS conectado');
        await pbus.discoverDevices(64);
      } else if (connId === 'radio') {
        await radioLink.connectAntenna();
        toast.success('📡 Antena rádio conectada');
        await radioLink.scanDevices();
      }
    } catch (err: any) {
      toast.error(`Falha: ${err.message}`);
    }
  }, [fireone, pbus, radioLink]);

  const handleDisconnect = useCallback(async (connId: string) => {
    if (connId === 'fireone') {
      await fireone.disconnect();
      toast.info('FireOne desconectado');
    } else if (connId === 'pbus') {
      pbus.disconnect();
      toast.info('PBUS desconectado');
    } else if (connId === 'radio') {
      await radioLink.disconnectAntenna();
      toast.info('Antena desconectada');
    }
  }, [fireone, pbus, radioLink]);

  const mob = isMobile;

  return (
    <div className={cn("space-y-3", fs ? "p-4" : "p-2")}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={cn("font-black uppercase tracking-wider text-foreground", fs ? "text-sm" : "text-[10px]")}>
            Conexões
          </h3>
          <p className={cn("text-muted-foreground/50", fs ? "text-[10px]" : "text-[8px]")}>
            {connections.filter(c => c.connected).length}/{connections.length} ativas
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-[9px]" onClick={() => toast.info('Abra a URL publicada para conectar hardware via WebSerial')}>
          <Plus className="w-3 h-3 mr-1" /> Adicionar
        </Button>
      </div>

      <ScrollArea className={cn(fs ? "max-h-[400px]" : "max-h-[300px]")}>
        <div className="space-y-2">
          {connections.map(conn => (
            <div key={conn.id} className={cn(
              "rounded-lg border transition-all",
              conn.connected ? "border-primary/20 bg-primary/5" : "border-border/15 bg-card/30"
            )}>
              {/* Header */}
              <div className={cn("flex items-center gap-2", fs ? "p-3" : "p-2")}>
                <div className={cn(
                  "rounded-full flex items-center justify-center",
                  conn.connected ? "bg-green-500/20" : "bg-muted/20",
                  "w-8 h-8"
                )}>
                {conn.id === 'radio'
                  ? <Radio className={cn("w-4 h-4", conn.connected ? "text-cyan-400" : "text-muted-foreground/30")} />
                  : conn.connected ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-muted-foreground/30" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("font-bold text-foreground", fs ? "text-xs" : "text-[10px]")}>{conn.name}</span>
                    <Badge variant="outline" className="text-[7px] h-3.5 px-1">{conn.protocol}</Badge>
                    {conn.baud && <span className="text-[7px] text-muted-foreground/30 font-mono">{conn.baud}bd</span>}
                  </div>
                  {conn.connected && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[7px] text-muted-foreground/40 font-mono">
                        TX: {(conn.txBytes / 1024).toFixed(1)}KB
                      </span>
                      <span className="text-[7px] text-muted-foreground/40 font-mono">
                        RX: {(conn.rxBytes / 1024).toFixed(1)}KB
                      </span>
                      {conn.latencyMs > 0 && (
                        <span className={cn("text-[7px] font-mono", conn.latencyMs > 500 ? 'text-amber-400/60' : 'text-green-400/60')}>
                          {conn.latencyMs}ms
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="flex items-center gap-1 text-[7px] text-muted-foreground/30">
                    <Switch
                      checked={autoReconnect[conn.id] ?? false}
                      onCheckedChange={(v) => setAutoReconnect(prev => ({ ...prev, [conn.id]: v }))}
                      className="h-3 w-6"
                    />
                    Auto
                  </label>
                  {conn.connected ? (
                    <Button size="sm" variant="ghost" className="h-6 text-[9px] px-2 text-red-400 hover:text-red-300"
                      onClick={() => handleDisconnect(conn.id)}>
                      <X className="w-3 h-3 mr-0.5" /> Off
                    </Button>
                  ) : (
                    <Button size="sm" className="h-6 text-[9px] px-3" onClick={() => handleConnect(conn.id)}>
                      Connect
                    </Button>
                  )}
                </div>
              </div>

              {/* Health bar */}
              {conn.connected && (
                <div className={cn("flex items-center gap-2 border-t border-border/10", fs ? "px-3 py-1.5" : "px-2 py-1")}>
                  <Activity className="w-3 h-3 text-green-400/50" />
                  <div className="flex-1 h-1 bg-muted/20 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500/60 rounded-full" style={{ width: `${Math.max(10, 100 - conn.packetLoss)}%` }} />
                  </div>
                  <span className="text-[7px] font-mono text-muted-foreground/30">
                    {conn.packetLoss}% loss
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Quick info */}
      <div className={cn("flex items-center justify-between text-muted-foreground/30 border-t border-border/10 pt-2", "text-[8px]")}>
        <span>FireOne: {fireone.modules.size} módulos</span>
        <span>PBUS: {pbus.deviceCount} dispositivos</span>
      </div>
    </div>
  );
}
