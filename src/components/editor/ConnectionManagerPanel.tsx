/**
 * ConnectionManagerPanel — Unified Connection Hub
 * Multi-transport FireOne: Cable RS-485, Radio, Wi-Fi Relay, Art-Net
 * Plus PBUS, Bluetooth, Art-Net, USB-C DMX
 */
import { useState, useCallback } from 'react';
import { Wifi, WifiOff, Radio, RefreshCw, Plus, X, Activity, Cable, Globe, Zap, Antenna } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { useRadioLink } from '@/hooks/useRadioLink';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { TransportStatus, TransportType } from '@/lib/fireoneTransport';

interface ConnectionManagerPanelProps {
  fs?: boolean;
  onClose?: () => void;
}

const TRANSPORT_ICONS: Record<TransportType, typeof Cable> = {
  serial: Cable,
  radio: Radio,
  wifi: Globe,
  wifi_direct: Antenna,
  artnet: Zap,
};

const TRANSPORT_LABELS: Record<TransportType, string> = {
  serial: 'RS-485 Cable',
  radio: 'Radio RF',
  wifi: 'Wi-Fi Relay',
  wifi_direct: 'Wi-Fi Direct',
  artnet: 'Art-Net DMX',
};

function TransportRow({ t, onRemove, fs }: { t: TransportStatus; onRemove: (id: string) => void; fs: boolean }) {
  const Icon = TRANSPORT_ICONS[t.type] || Cable;
  const stateColor = t.state === 'connected' ? 'text-green-400' : t.state === 'connecting' || t.state === 'reconnecting' ? 'text-amber-400' : 'text-muted-foreground/30';

  return (
    <div className={cn("flex items-center gap-2 border-t border-border/10", fs ? "px-3 py-1.5" : "px-2 py-1")}>
      <Icon className={cn("w-3 h-3", stateColor)} />
      <span className="text-[8px] font-mono text-foreground/70 flex-1">{TRANSPORT_LABELS[t.type]}</span>
      <Badge variant="outline" className={cn("text-[6px] h-3 px-1", t.state === 'connected' ? 'border-green-500/30 text-green-400' : '')}>
        {t.state}
      </Badge>
      {t.state === 'connected' && (
        <span className="text-[7px] font-mono text-muted-foreground/40">{t.latencyMs}ms</span>
      )}
      <span className="text-[6px] text-muted-foreground/30">P{t.priority}</span>
      <Button size="sm" variant="ghost" className="h-4 w-4 p-0 text-muted-foreground/30 hover:text-red-400"
        onClick={() => onRemove(t.id)}>
        <X className="w-2.5 h-2.5" />
      </Button>
    </div>
  );
}

export default function ConnectionManagerPanel({ fs = false, onClose }: ConnectionManagerPanelProps) {
  const isMobile = useIsMobile();
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();
  const radioLink = useRadioLink();
  const [autoReconnect, setAutoReconnect] = useState<Record<string, boolean>>({});
  const [showWiFiInput, setShowWiFiInput] = useState(false);
  const [wifiIp, setWifiIp] = useState('192.168.1.100');
  const [showArtNetInput, setShowArtNetInput] = useState(false);
  const [artnetIp, setArtnetIp] = useState('2.0.0.1');

  const fireoneTotalTx = fireone.transports.reduce((s, t) => s + t.txBytes, 0);
  const fireoneTotalRx = fireone.transports.reduce((s, t) => s + t.rxBytes, 0);

  const connections = [
    {
      id: 'fireone',
      name: 'FireOne XLII+',
      protocol: 'Multi-Transport',
      connected: fireone.isConnected,
      autoReconnect: autoReconnect['fireone'] ?? false,
      txBytes: fireoneTotalTx || fireone.txBytes,
      rxBytes: fireoneTotalRx || fireone.rxBytes,
      latencyMs: fireone.transports.find(t => t.state === 'connected')?.latencyMs ?? 0,
      packetLoss: 0,
      transportCount: fireone.transports.filter(t => t.state === 'connected').length,
      totalTransports: fireone.transports.length,
    },
    {
      id: 'pbus',
      name: 'PBUS Network',
      protocol: 'Serial 19200',
      connected: pbus.isConnected,
      autoReconnect: autoReconnect['pbus'] ?? false,
      txBytes: pbus.txBytes,
      rxBytes: pbus.rxBytes,
      latencyMs: 0,
      packetLoss: 0,
      transportCount: 0,
      totalTransports: 0,
    },
    {
      id: 'bluetooth',
      name: 'Bluetooth BLE',
      protocol: 'GATT',
      connected: false,
      autoReconnect: autoReconnect['bluetooth'] ?? false,
      txBytes: 0, rxBytes: 0, latencyMs: 0, packetLoss: 0,
      transportCount: 0, totalTransports: 0,
    },
    {
      id: 'dmxoutput',
      name: 'USB-C DMX',
      protocol: 'Serial 250K',
      connected: false,
      autoReconnect: autoReconnect['dmxoutput'] ?? false,
      txBytes: 0, rxBytes: 0, latencyMs: 0, packetLoss: 0,
      transportCount: 0, totalTransports: 0,
    },
  ];

  const handleConnect = useCallback(async (connId: string) => {
    try {
      if (connId === 'fireone') {
        await fireone.connect();
        toast.success('FireOne RS-485 conectado');
        await fireone.discoverModules(40);
      } else if (connId === 'pbus') {
        await pbus.connect();
        toast.success('PBUS conectado');
        await pbus.discoverDevices(64);
      }
    } catch (err: any) {
      toast.error(`Falha: ${err.message}`);
    }
  }, [fireone, pbus]);

  const handleDisconnect = useCallback(async (connId: string) => {
    if (connId === 'fireone') {
      await fireone.disconnect();
      toast.info('FireOne desconectado');
    } else if (connId === 'pbus') {
      pbus.disconnect();
      toast.info('PBUS desconectado');
    }
  }, [fireone, pbus]);

  const handleAddWiFi = useCallback(async () => {
    try {
      await fireone.connectWiFi(wifiIp);
      toast.success(`Wi-Fi relay conectado: ${wifiIp}`);
      setShowWiFiInput(false);
    } catch (err: any) {
      toast.error(`Wi-Fi falhou: ${err.message}`);
    }
  }, [fireone, wifiIp]);

  const handleAddRadio = useCallback(async () => {
    try {
      await fireone.connectRadio();
      toast.success('📡 Radio transport adicionado');
    } catch (err: any) {
      toast.error(`Radio falhou: ${err.message}`);
    }
  }, [fireone]);

  const handleAddArtNet = useCallback(async () => {
    try {
      await fireone.connectArtNet(artnetIp);
      toast.success(`Art-Net conectado: ${artnetIp}`);
      setShowArtNetInput(false);
    } catch (err: any) {
      toast.error(`Art-Net falhou: ${err.message}`);
    }
  }, [fireone, artnetIp]);

  const totalConnected = connections.filter(c => c.connected).length;
  const totalDevices = fireone.modules.size + pbus.deviceCount + radioLink.devices.size;

  return (
    <div className={cn("space-y-3", fs ? "p-4" : "p-2")}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={cn("font-black uppercase tracking-wider text-foreground", fs ? "text-sm" : "text-[10px]")}>
            Conexões
          </h3>
          <p className={cn("text-muted-foreground/50", fs ? "text-[10px]" : "text-[8px]")}>
            {totalConnected}/{connections.length} ativas
            {totalDevices > 0 && <span className="ml-1 text-foreground/60">· {totalDevices} devices</span>}
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-[9px]" onClick={async () => {
          toast.info('Testando conexões...');
          const r: string[] = [];
          if (fireone.isConnected) r.push(`FireOne: ${fireone.modules.size} mod (${fireone.transports.filter(t => t.state === 'connected').length} paths)`);
          if (pbus.isConnected) r.push(`PBUS: ${pbus.deviceCount} disp.`);
          if (r.length === 0) toast.warning('Nenhuma conexão ativa');
          else toast.success(r.join(' · '));
        }}>
          <RefreshCw className="w-3 h-3 mr-1" /> Test
        </Button>
      </div>

      <ScrollArea className={cn(fs ? "max-h-[450px]" : "max-h-[350px]")}>
        <div className="space-y-2">
          {connections.map(conn => (
            <div key={conn.id} className={cn(
              "rounded-lg border transition-all",
              conn.connected ? "border-primary/20 bg-primary/5" : "border-border/15 bg-card/30"
            )}>
              {/* Connection header */}
              <div className={cn("flex items-center gap-2", fs ? "p-3" : "p-2")}>
                <div className={cn("rounded-full flex items-center justify-center w-8 h-8",
                  conn.connected ? "bg-green-500/20" : "bg-muted/20"
                )}>
                  {conn.connected ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-muted-foreground/30" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("font-bold text-foreground", fs ? "text-xs" : "text-[10px]")}>{conn.name}</span>
                    <Badge variant="outline" className="text-[7px] h-3.5 px-1">{conn.protocol}</Badge>
                    {conn.id === 'fireone' && conn.transportCount > 0 && (
                      <Badge variant="outline" className="text-[6px] h-3 px-1 border-green-500/30 text-green-400">
                        {conn.transportCount} path{conn.transportCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  {conn.connected && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[7px] text-muted-foreground/40 font-mono">TX: {(conn.txBytes / 1024).toFixed(1)}KB</span>
                      <span className="text-[7px] text-muted-foreground/40 font-mono">RX: {(conn.rxBytes / 1024).toFixed(1)}KB</span>
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

              {/* FireOne multi-transport sub-rows */}
              {conn.id === 'fireone' && fireone.transports.length > 0 && (
                <div>
                  {fireone.transports.map(t => (
                    <TransportRow key={t.id} t={t} onRemove={fireone.removeTransport} fs={fs} />
                  ))}
                </div>
              )}

              {/* FireOne: add transport buttons */}
              {conn.id === 'fireone' && (
                <div className={cn("flex flex-wrap items-center gap-1 border-t border-border/10", fs ? "px-3 py-1.5" : "px-2 py-1")}>
                  <Button size="sm" variant="ghost" className="h-5 text-[8px] px-2" onClick={handleAddRadio}>
                    <Radio className="w-2.5 h-2.5 mr-0.5" /> +Radio
                  </Button>
                  <Button size="sm" variant="ghost" className="h-5 text-[8px] px-2" onClick={() => setShowWiFiInput(v => !v)}>
                    <Globe className="w-2.5 h-2.5 mr-0.5" /> +Wi-Fi
                  </Button>
                  <Button size="sm" variant="ghost" className="h-5 text-[8px] px-2" onClick={async () => {
                    try {
                      await fireone.connectWiFiDirect();
                      toast.success('Wi-Fi Direct conectado (auto-discovery)');
                    } catch (err: any) {
                      toast.error(`Wi-Fi Direct: ${err.message}`);
                    }
                  }}>
                    <Antenna className="w-2.5 h-2.5 mr-0.5" /> +Wi-Fi Direct
                  </Button>
                  <Button size="sm" variant="ghost" className="h-5 text-[8px] px-2" onClick={() => setShowArtNetInput(v => !v)}>
                    <Zap className="w-2.5 h-2.5 mr-0.5" /> +Art-Net
                  </Button>
                  {fireone.isConnected && (
                    <span className="text-[7px] text-amber-400/60 ml-auto">
                      E-STOP → {fireone.transports.filter(t => t.state === 'connected').length} paths
                    </span>
                  )}
                </div>
              )}

              {/* Wi-Fi input */}
              {conn.id === 'fireone' && showWiFiInput && (
                <div className={cn("flex items-center gap-1 border-t border-border/10", fs ? "px-3 py-1.5" : "px-2 py-1")}>
                  <Input
                    value={wifiIp}
                    onChange={(e) => setWifiIp(e.target.value)}
                    placeholder="192.168.1.100"
                    className="h-5 text-[9px] flex-1"
                  />
                  <Button size="sm" className="h-5 text-[8px] px-2" onClick={handleAddWiFi}>Conectar</Button>
                </div>
              )}

              {/* Art-Net input */}
              {conn.id === 'fireone' && showArtNetInput && (
                <div className={cn("flex items-center gap-1 border-t border-border/10", fs ? "px-3 py-1.5" : "px-2 py-1")}>
                  <Input
                    value={artnetIp}
                    onChange={(e) => setArtnetIp(e.target.value)}
                    placeholder="2.0.0.1"
                    className="h-5 text-[9px] flex-1"
                  />
                  <Button size="sm" className="h-5 text-[8px] px-2" onClick={handleAddArtNet}>Conectar</Button>
                </div>
              )}

              {/* Health bar */}
              {conn.connected && (
                <div className={cn("flex items-center gap-2 border-t border-border/10", fs ? "px-3 py-1.5" : "px-2 py-1")}>
                  <Activity className="w-3 h-3 text-green-400/50" />
                  <div className="flex-1 h-1 bg-muted/20 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500/60 rounded-full" style={{ width: `${Math.max(10, 100 - conn.packetLoss)}%` }} />
                  </div>
                  <span className="text-[7px] font-mono text-muted-foreground/30">{conn.packetLoss}% loss</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Quick info */}
      <div className={cn("flex items-center justify-between text-muted-foreground/30 border-t border-border/10 pt-2", "text-[8px]")}>
        <span>FireOne: {fireone.modules.size} módulos</span>
        <span>PBUS: {pbus.deviceCount} disp.</span>
        <span>Transports: {fireone.transports.filter(t => t.state === 'connected').length} ativos</span>
      </div>
    </div>
  );
}
