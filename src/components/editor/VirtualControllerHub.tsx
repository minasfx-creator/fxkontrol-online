/**
 * VirtualControllerHub — Central Hardware Dashboard
 * Grouped by manufacturer with live telemetry from hardware hooks.
 */
import { useState, useCallback, useMemo } from 'react';
import { Cpu, Wifi, WifiOff, Usb, Radio, Zap, Battery, Signal, ChevronRight, ChevronDown, Sparkles, Cable, Antenna } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ConnectionType = 'usb' | 'artnet' | 'wireless' | 'pbus' | 'serial' | 'radio' | 'sim' | 'ble' | 'wifi_direct';

interface ControllerCard {
  id: string;
  name: string;
  manufacturer: string;
  type: 'firing' | 'sfx' | 'remote' | 'dmx' | 'laser' | 'module';
  connectionTypes: ConnectionType[];
  channels: number;
  description: string;
  panelMode?: string;
  group: 'fireone' | 'showven' | 'infrastructure' | 'drones';
  platformLabel?: string;
}

const CONTROLLERS: ControllerCard[] = [
  { id: 'fireone-xl4', name: 'FXK-PYRO', manufacturer: 'FXK', type: 'firing', connectionTypes: ['usb', 'serial', 'radio', 'wifi_direct'], channels: 32, description: 'IFMx-i32Q field modules · RS-485 · 32 igniters/module', panelMode: 'pyro_fire', group: 'fireone', platformLabel: 'XL4+ 2.0' },
  { id: 'zk6200', name: 'ZK6200', manufacturer: 'Showven', type: 'sfx', connectionTypes: ['usb', 'artnet', 'wireless'], channels: 20, description: 'Host controller · 20 zones · DMX + LTC', panelMode: 'zk6200', group: 'showven' },
  { id: 'zk6300', name: 'ZK6300', manufacturer: 'Showven', type: 'sfx', connectionTypes: ['usb', 'artnet', 'wireless'], channels: 30, description: 'Host controller · 30 zones · DMX + LTC', panelMode: 'zk6200', group: 'showven' },
  { id: 'pyroslave-c16', name: 'PyroSlave C16', manufacturer: 'Showven', type: 'firing', connectionTypes: ['pbus', 'wireless', 'radio'], channels: 16, description: 'Wireless slave · 16 cues · Dual-band 433/868M', panelMode: 'pbus', group: 'showven' },
  { id: 'fxbutton', name: 'FXbutton', manufacturer: 'Showven', type: 'remote', connectionTypes: ['wireless', 'radio'], channels: 8, description: 'Wireless remote · 1/4/8 buttons', panelMode: 'fxbutton', group: 'showven' },
  { id: 'pyromote', name: 'PyroMote', manufacturer: 'Showven', type: 'remote', connectionTypes: ['wireless', 'radio'], channels: 4, description: 'Compact remote · 4 channels · IP65', panelMode: 'fxbutton', group: 'showven' },
  { id: 'maiman', name: 'Maiman 30W', manufacturer: 'Showven', type: 'laser', connectionTypes: ['artnet'], channels: 14, description: '30W RGB laser · ILDA + DMX · IP54', group: 'showven' },
  { id: 'dmx-splitter8', name: 'DMX Splitter 8', manufacturer: 'Showven', type: 'dmx', connectionTypes: ['usb'], channels: 8, description: '1→8 DMX512 splitter · Opto-isolated', group: 'infrastructure' },
  { id: 'dmx-relay-r12', name: 'DMX Relay R12', manufacturer: 'Showven', type: 'dmx', connectionTypes: ['usb', 'artnet'], channels: 12, description: '12-channel DMX relay · 10A/channel', group: 'infrastructure' },
  { id: 'ifmx-i32q-module', name: 'FXK-PYRO Module', manufacturer: 'FXK', type: 'module', connectionTypes: ['wireless', 'ble', 'usb', 'wifi_direct'], channels: 32, description: 'Virtual field module · 32 igniters · CDS · ESP32 bridge', panelMode: 'module', group: 'fireone', platformLabel: 'XL4+ 2.0' },
  { id: 'fxk-swarm', name: 'FXK-SWARM', manufacturer: 'FXK', type: 'module', connectionTypes: ['wifi_direct', 'radio'], channels: 500, description: 'Swarm controller · 500 drones · GPS+RTK', panelMode: 'drone_ops', group: 'drones', platformLabel: 'SWARM OPS 2.0' },
];

const CONNECTION_ICONS: Record<ConnectionType, typeof Usb> = {
  usb: Usb,
  artnet: Wifi,
  wireless: Radio,
  pbus: Cable,
  serial: Cpu,
  radio: Radio,
  sim: Sparkles,
  ble: Radio,
  wifi_direct: Antenna,
};

const TYPE_COLORS: Record<string, string> = {
  firing: 'text-red-400',
  sfx: 'text-amber-400',
  remote: 'text-cyan-400',
  dmx: 'text-green-400',
  laser: 'text-purple-400',
  module: 'text-orange-400',
};

const GROUP_META: Record<string, { label: string; color: string }> = {
  fireone: { label: 'FXK Fire Systems', color: 'text-red-400' },
  showven: { label: 'Showven Devices', color: 'text-amber-400' },
  infrastructure: { label: 'Infrastructure', color: 'text-muted-foreground' },
};

interface VirtualControllerHubProps {
  fs?: boolean;
  onSelectMode?: (mode: string) => void;
  onClose?: () => void;
}

export default function VirtualControllerHub({ fs = false, onSelectMode, onClose }: VirtualControllerHubProps) {
  const isMobile = useIsMobile();
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ fireone: true, showven: true, infrastructure: true });

  const toggleGroup = useCallback((group: string) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  }, []);

  const grouped = useMemo(() => {
    const groups: Record<string, ControllerCard[]> = { fireone: [], showven: [], infrastructure: [] };
    CONTROLLERS.forEach(c => groups[c.group].push(c));
    return groups;
  }, []);

  const connectedCount = useMemo(() => {
    let count = 0;
    if (fireone.isConnected) count++;
    if (pbus.isConnected) count += pbus.deviceCount;
    return count;
  }, [fireone.isConnected, pbus.isConnected, pbus.deviceCount]);

  const getConnectionStatus = useCallback((card: ControllerCard): { live: boolean; label: string; type: ConnectionType } => {
    if (card.id === 'fireone-xl4' && fireone.isConnected) return { live: true, label: `${fireone.modules.size} módulos`, type: 'serial' };
    if ((card.id === 'pyroslave-c16' || card.id === 'pyromote') && pbus.isConnected) return { live: true, label: `${pbus.deviceCount} dev`, type: pbus.connectionPath === 'radio' ? 'radio' : 'pbus' };
    return { live: false, label: 'SIM', type: 'sim' };
  }, [fireone.isConnected, fireone.modules.size, pbus.isConnected, pbus.deviceCount, pbus.connectionPath]);

  const getLiveTelemetry = useCallback((card: ControllerCard) => {
    if (card.id === 'fireone-xl4' && fireone.isConnected) {
      return {
        battery: null,
        rssi: fireone.worstRssi,
        extra: `TX:${fireone.txBytes}B`,
      };
    }
    if ((card.id === 'pyroslave-c16' || card.id === 'pyromote' || card.id === 'fxbutton') && pbus.isConnected) {
      return {
        battery: pbus.worstBattery,
        rssi: null,
        extra: pbus.bestBand !== 'dual' ? pbus.bestBand : '433/868M',
      };
    }
    return null;
  }, [fireone, pbus]);

  const handleConnect = useCallback(async (card: ControllerCard, connType: ConnectionType) => {
    try {
      if (connType === 'usb' || connType === 'serial') {
        if (card.id === 'fireone-xl4') {
          await fireone.connect();
          toast.success(`FXK-PYRO conectado via RS-485`);
          return;
        }
      }
      if (connType === 'wifi_direct') {
        await fireone.connectWiFiDirect();
        toast.success(`${card.name}: Wi-Fi Direct conectado`);
        return;
      }
      if (connType === 'pbus') {
        await pbus.connect();
        toast.success('PBUS conectado — escaneando dispositivos...');
        await pbus.discoverDevices(64);
        return;
      }
      toast.info(`${card.name}: modo SIM ativo — conecte via USB publicado`);
    } catch (err: any) {
      toast.error(`Falha: ${err.message}`);
    }
  }, [fireone, pbus]);

  const renderCard = (card: ControllerCard) => {
    const status = getConnectionStatus(card);
    const telemetry = getLiveTelemetry(card);
    return (
      <button
        key={card.id}
        onClick={() => card.panelMode && onSelectMode?.(card.panelMode)}
        className={cn(
          "w-full text-left rounded-lg border transition-all group",
          "hover:border-primary/30 active:scale-[0.97]",
          status.live
            ? "border-primary/20 bg-primary/5"
            : "border-border/15 bg-card/30",
          isMobile ? "p-4 min-h-[56px]" : fs ? "p-3" : "p-2"
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className={cn(
            "rounded-lg flex items-center justify-center shrink-0",
            isMobile ? "w-10 h-10" : "w-8 h-8",
            "bg-muted/20"
          )}>
            <Cpu className={cn("w-4 h-4", TYPE_COLORS[card.type] || 'text-muted-foreground')} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={cn("font-bold text-foreground truncate", fs ? "text-xs" : "text-[10px]")}>
                {card.name}
              </span>
              <Badge
                variant={status.live ? 'default' : 'outline'}
                className={cn("text-[7px] h-3.5 px-1", status.live ? "bg-green-600/80" : "")}
              >
                {status.label}
              </Badge>
            </div>
            <p className={cn("text-muted-foreground/40 truncate", fs ? "text-[9px]" : "text-[7px]")}>
              {card.description}
            </p>
            {/* Live telemetry */}
            {telemetry && (
              <div className="flex items-center gap-2 mt-0.5">
                {telemetry.battery !== null && (
                  <span className={cn("text-[7px] flex items-center gap-0.5",
                    telemetry.battery < 3.3 ? "text-destructive" : "text-emerald-400/70")}>
                    <Battery className="w-2.5 h-2.5" /> {telemetry.battery.toFixed(1)}V
                  </span>
                )}
                {telemetry.rssi !== null && (
                  <span className={cn("text-[7px] flex items-center gap-0.5",
                    telemetry.rssi > -60 ? "text-emerald-400/70" : telemetry.rssi > -75 ? "text-amber-400/70" : "text-destructive")}>
                    <Signal className="w-2.5 h-2.5" /> {telemetry.rssi}dBm
                  </span>
                )}
                {telemetry.extra && (
                  <span className="text-[7px] text-muted-foreground/40">{telemetry.extra}</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1 mt-1">
              {card.connectionTypes.map(ct => {
                const Icon = CONNECTION_ICONS[ct];
                return (
                  <button
                    key={ct}
                    onClick={(e) => { e.stopPropagation(); handleConnect(card, ct); }}
                    className={cn(
                      "rounded px-1.5 py-0.5 flex items-center gap-0.5 transition-colors",
                      "bg-muted/10 hover:bg-muted/20 text-muted-foreground/50 hover:text-foreground/70",
                      "text-[7px] uppercase font-bold"
                    )}
                  >
                    <Icon className="w-2.5 h-2.5" />
                    {ct}
                  </button>
                );
              })}
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors shrink-0 mt-1" />
        </div>
      </button>
    );
  };

  return (
    <div className={cn("space-y-3", fs ? "p-4" : "p-2")}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={cn("font-black uppercase tracking-wider text-foreground", fs ? "text-sm" : "text-[10px]")}>
            Controladores
          </h3>
          <p className={cn("text-muted-foreground/50", fs ? "text-[10px]" : "text-[8px]")}>
            {connectedCount} conectados / {CONTROLLERS.length} disponíveis
          </p>
        </div>
        {onClose && (
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}>
            <span className="sr-only">Fechar</span>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </Button>
        )}
        <div className="flex items-center gap-1.5">
          {fireone.isConnected && (
            <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-red-500/30 text-red-400">
              FXK · {fireone.modules.size}
            </Badge>
          )}
          {pbus.isConnected && (
            <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-amber-500/30 text-amber-400">
              PBUS · {pbus.deviceCount}
              {pbus.worstBattery !== null && (
                <span className={cn("ml-1", (pbus.worstBattery ?? 4) < 3.3 ? 'text-destructive' : '')}>
                  · {(pbus.worstBattery ?? 0).toFixed(1)}V
                </span>
              )}
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className={cn(fs ? "max-h-[500px]" : "max-h-[350px]")}>
        <div className="space-y-2">
          {Object.entries(grouped).map(([group, cards]) => {
            const meta = GROUP_META[group];
            const isOpen = openGroups[group] ?? true;
            return (
              <Collapsible key={group} open={isOpen} onOpenChange={() => toggleGroup(group)}>
                <CollapsibleTrigger className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent/5 rounded-lg transition-colors">
                  {isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground/50" /> : <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
                  <span className={cn("text-[9px] font-bold uppercase tracking-wider", meta.color)}>{meta.label}</span>
                  <Badge variant="secondary" className="ml-auto text-[8px] h-4 px-1.5">{cards.length}</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className={cn("grid gap-2 mt-1", isMobile ? "grid-cols-1" : fs ? "grid-cols-2" : "grid-cols-1")}>
                    {cards.map(renderCard)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
