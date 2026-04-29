/**
 * ─── TuyaControllerCard — direct ON/OFF for Tuya/CubeMesh outlets ──
 * Inline actions: ON, OFF (each hold 400ms), and ALL OFF (hold 400ms,
 * destructive). Always shows the LOW-PRECISION badge to remind the
 * operator these outlets are NOT pyro-grade (200–800ms latency).
 *
 * Honest-hardware: today no real BLE write path exists, so the action
 * buttons report the result returned by `tuyaOutletControl`. When the
 * adapter returns `NO_REAL_SENDER`, the toast steers the operator to
 * the BLE pairing wizard.
 */
import { useCallback } from 'react';
import { X, Plug, PlugZap, Power, Bluetooth, Usb, Network, Wifi, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ActiveController } from '@/hooks/useActiveControllers';
import { tuyaOutletControl } from '@/core/hardware/tuyaOutletControl';
import { HoldToConfirmButton } from '../shared/HoldToConfirmButton';
import type { DiscoveryTransport } from '@/core/discovery/types';

const HOLD_MS = 400;

function TransportIcon({ transport }: { transport: DiscoveryTransport | null }) {
  const cls = 'h-3.5 w-3.5';
  if (transport === 'webserial' || transport === 'webusb') return <Usb className={cls} />;
  if (transport === 'webble') return <Bluetooth className={cls} />;
  if (transport === 'mdns-artnet') return <Network className={cls} />;
  return <Wifi className={cls} />;
}

export interface TuyaControllerCardProps {
  controller: ActiveController;
  onClose: () => void;
  onOpenConsole: () => void;
}

export function TuyaControllerCard({ controller, onClose, onOpenConsole }: TuyaControllerCardProps) {
  const dev = controller.device;
  const realSender = tuyaOutletControl.hasRealSender();

  const onTurnOn = useCallback(async () => {
    const r = await tuyaOutletControl.turnOn(dev);
    if (r.ok === true) toast.success(`${dev.label} ON ✓`);
    else toast.error(`ON falhou: ${r.message}`, { duration: 5000 });
  }, [dev]);

  const onTurnOff = useCallback(async () => {
    const r = await tuyaOutletControl.turnOff(dev);
    if (r.ok === true) toast.success(`${dev.label} OFF ✓`);
    else toast.error(`OFF falhou: ${r.message}`, { duration: 5000 });
  }, [dev]);

  const onAllOff = useCallback(async () => {
    const r = await tuyaOutletControl.allOff();
    if (r.ok === r.attempted) toast.success(`ALL OFF: ${r.ok}/${r.attempted} ✓`);
    else if (r.ok > 0) toast.warning(`ALL OFF: ${r.ok} ok, ${r.failed} falharam`);
    else toast.error(`ALL OFF falhou em todos (${r.failed})`, { duration: 5000 });
  }, []);

  return (
    <div
      className="min-w-[280px] max-w-[320px] rounded-lg border border-border bg-card p-3 shadow-xl backdrop-blur"
      role="region"
      aria-label={`Tuya outlet: ${controller.profile.label}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary" />
            <span className="truncate text-sm font-semibold">{controller.profile.label}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <TransportIcon transport={dev.activeTransport} />
            <span className="truncate">{dev.label}</span>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={onClose} aria-label="Fechar">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1">
        <Badge variant="default" className="h-5 px-1.5 text-[10px]">ONLINE</Badge>
        <Badge
          variant="outline"
          className="h-5 border-yellow-500/40 px-1.5 text-[10px] text-yellow-500"
        >
          LOW-PRECISION
        </Badge>
        {!realSender && (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
            NO SENDER
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <HoldToConfirmButton
          holdMs={HOLD_MS}
          onConfirm={onTurnOn}
          disabled={!realSender || !dev.online}
          variant="outline"
          tooltip={!realSender ? 'Caminho de escrita Tuya BLE ainda não disponível' : undefined}
          ariaLabel="Ligar outlet"
        >
          <PlugZap className="mr-1 h-3.5 w-3.5" />
          ON
        </HoldToConfirmButton>
        <HoldToConfirmButton
          holdMs={HOLD_MS}
          onConfirm={onTurnOff}
          disabled={!realSender || !dev.online}
          variant="outline"
          tooltip={!realSender ? 'Caminho de escrita Tuya BLE ainda não disponível' : undefined}
          ariaLabel="Desligar outlet"
        >
          <Power className="mr-1 h-3.5 w-3.5" />
          OFF
        </HoldToConfirmButton>
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <HoldToConfirmButton
          holdMs={HOLD_MS}
          onConfirm={onAllOff}
          disabled={!realSender}
          variant="destructive"
          tooltip={!realSender ? 'Sem sender real ativo' : 'Desliga todos os Tuya/CubeMesh online'}
          ariaLabel="Desligar todos os outlets"
        >
          <Power className="mr-1 h-3.5 w-3.5" />
          ALL OFF
        </HoldToConfirmButton>
        <Button size="sm" variant="ghost" className={cn('h-8 text-xs')} onClick={onOpenConsole}>
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          Console
        </Button>
      </div>
    </div>
  );
}

export default TuyaControllerCard;
