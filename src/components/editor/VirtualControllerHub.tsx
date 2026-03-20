/**
 * VirtualControllerHub — Central Hardware Dashboard
 * Lists all virtual and real controllers with connection state and quick launch.
 */
import { useState, useCallback } from 'react';
import { Cpu, Wifi, WifiOff, Usb, Radio, Zap, Battery, Signal, ChevronRight, Sparkles, Cable } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ConnectionType = 'usb' | 'artnet' | 'wireless' | 'pbus' | 'serial' | 'radio' | 'sim';

interface ControllerCard {
  id: string;
  name: string;
  manufacturer: string;
  type: 'firing' | 'sfx' | 'remote' | 'dmx' | 'laser';
  connectionTypes: ConnectionType[];
  channels: number;
  description: string;
  panelMode?: string;
}

const CONTROLLERS: ControllerCard[] = [
  { id: 'fireone-xl4', name: 'FireOne XL4+', manufacturer: 'FireOne', type: 'firing', connectionTypes: ['usb', 'serial', 'radio'], channels: 32, description: 'IFMx-i32Q field modules · RS-485 · 32 igniters/module', panelMode: 'pyro_fire' },
  { id: 'zk6200', name: 'ZK6200', manufacturer: 'Showven', type: 'sfx', connectionTypes: ['usb', 'artnet', 'wireless'], channels: 20, description: 'Host controller · 20 zones · DMX + LTC', panelMode: 'zk6200' },
  { id: 'zk6300', name: 'ZK6300', manufacturer: 'Showven', type: 'sfx', connectionTypes: ['usb', 'artnet', 'wireless'], channels: 30, description: 'Host controller · 30 zones · DMX + LTC', panelMode: 'zk6200' },
  { id: 'pyroslave-c16', name: 'PyroSlave C16', manufacturer: 'Showven', type: 'firing', connectionTypes: ['pbus', 'wireless', 'radio'], channels: 16, description: 'Wireless slave · 16 cues · Dual-band 433/868M', panelMode: 'pbus' },
  { id: 'fxbutton', name: 'FXbutton', manufacturer: 'Showven', type: 'remote', connectionTypes: ['wireless', 'radio'], channels: 8, description: 'Wireless remote · 1/4/8 buttons', panelMode: 'fxbutton' },
  { id: 'pyromote', name: 'PyroMote', manufacturer: 'Showven', type: 'remote', connectionTypes: ['wireless', 'radio'], channels: 4, description: 'Compact remote · 4 channels · IP65', panelMode: 'fxbutton' },
  { id: 'dmx-splitter8', name: 'DMX Splitter 8', manufacturer: 'Showven', type: 'dmx', connectionTypes: ['usb'], channels: 8, description: '1→8 DMX512 splitter · Opto-isolated' },
  { id: 'dmx-relay-r12', name: 'DMX Relay R12', manufacturer: 'Showven', type: 'dmx', connectionTypes: ['usb', 'artnet'], channels: 12, description: '12-channel DMX relay · 10A/channel' },
  { id: 'maiman', name: 'Maiman 30W', manufacturer: 'Showven', type: 'laser', connectionTypes: ['artnet'], channels: 14, description: '30W RGB laser · ILDA + DMX · IP54' },
];

const CONNECTION_ICONS: Record<ConnectionType, typeof Usb> = {
  usb: Usb,
  artnet: Wifi,
  wireless: Radio,
  pbus: Cable,
  serial: Cpu,
  radio: Radio,
  sim: Sparkles,
};

const TYPE_COLORS: Record<string, string> = {
  firing: 'text-red-400',
  sfx: 'text-amber-400',
  remote: 'text-cyan-400',
  dmx: 'text-green-400',
  laser: 'text-purple-400',
};

interface VirtualControllerHubProps {
  fs?: boolean;
  onSelectMode?: (mode: string) => void;
}

export default function VirtualControllerHub({ fs = false, onSelectMode }: VirtualControllerHubProps) {
  const isMobile = useIsMobile();
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();

  const getConnectionStatus = useCallback((card: ControllerCard): { live: boolean; label: string; type: ConnectionType } => {
    if (card.id === 'fireone-xl4' && fireone.isConnected) return { live: true, label: `${fireone.modules.size} módulos`, type: 'serial' };
    if ((card.id === 'pyroslave-c16' || card.id === 'pyromote') && pbus.isConnected) return { live: true, label: `${pbus.deviceCount} dispositivos`, type: 'pbus' };
    return { live: false, label: 'SIM', type: 'sim' };
  }, [fireone.isConnected, fireone.modules.size, pbus.isConnected, pbus.deviceCount]);

  const handleConnect = useCallback(async (card: ControllerCard, connType: ConnectionType) => {
    try {
      if (connType === 'usb' || connType === 'serial') {
        if (card.id === 'fireone-xl4') {
          await fireone.connect();
          toast.success(`FireOne XL4+ conectado via RS-485`);
          return;
        }
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

  return (
    <div className={cn("space-y-3", fs ? "p-4" : "p-2")}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={cn("font-black uppercase tracking-wider text-foreground", fs ? "text-sm" : "text-[10px]")}>
            Controladores
          </h3>
          <p className={cn("text-muted-foreground/50", fs ? "text-[10px]" : "text-[8px]")}>
            Virtuais & Hardware — {CONTROLLERS.length} dispositivos
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {fireone.isConnected && (
            <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-red-500/30 text-red-400">
              FireOne · {fireone.modules.size}
              {fireone.worstBattery !== null && (
                <span className={cn("ml-1", (fireone.worstBattery ?? 12) < 11 ? 'text-destructive' : '')}>
                  {(fireone.worstBattery ?? 0).toFixed(1)}V
                </span>
              )}
            </Badge>
          )}
          {pbus.isConnected && (
            <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-amber-500/30 text-amber-400">
              PBUS · {pbus.deviceCount}
              {pbus.worstBattery !== null && (
                <span className={cn("ml-1", (pbus.worstBattery ?? 4) < 3.3 ? 'text-destructive' : '')}>
                  {(pbus.worstBattery ?? 0).toFixed(1)}V
                </span>
              )}
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className={cn(fs ? "max-h-[500px]" : "max-h-[350px]")}>
        <div className={cn("grid gap-2", isMobile ? "grid-cols-1" : fs ? "grid-cols-2" : "grid-cols-1")}>
          {CONTROLLERS.map(card => {
            const status = getConnectionStatus(card);
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
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
