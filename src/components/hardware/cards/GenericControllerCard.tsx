/**
 * ─── GenericControllerCard — fallback for unknown / un-actioned kinds ─
 * Used when a recognised device has no inline action set yet (today
 * only `unknown`, defensively). Just labels the device and offers the
 * deep-link to whatever console route exists.
 */
import { X, AlertTriangle, ExternalLink, Bluetooth, Usb, Network, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ActiveController } from '@/hooks/useActiveControllers';
import { LiveStatusChip } from '../shared/LiveStatusChip';
import type { DiscoveryTransport } from '@/core/discovery/types';

function TransportIcon({ transport }: { transport: DiscoveryTransport | null }) {
  const cls = 'h-3.5 w-3.5';
  if (transport === 'webserial' || transport === 'webusb') return <Usb className={cls} />;
  if (transport === 'webble') return <Bluetooth className={cls} />;
  if (transport === 'mdns-artnet') return <Network className={cls} />;
  return <Wifi className={cls} />;
}

export interface GenericControllerCardProps {
  controller: ActiveController;
  onClose: () => void;
  onOpenConsole: () => void;
}

export function GenericControllerCard({ controller, onClose, onOpenConsole }: GenericControllerCardProps) {
  const { capabilities } = controller.profile;
  return (
    <div
      className="min-w-[260px] max-w-[300px] rounded-lg border border-border bg-card p-3 shadow-xl backdrop-blur"
      role="region"
      aria-label={`Controller: ${controller.profile.label}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <span className="truncate text-sm font-semibold">{controller.profile.label}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <TransportIcon transport={controller.device.activeTransport} />
            <span className="truncate">{controller.device.label}</span>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={onClose} aria-label="Fechar">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        <LiveStatusChip
          status="read-only"
          reason="Dispositivo descoberto mas sem ações inline — abra Console para classificar"
        />
        <Badge variant="default" className="h-5 px-1.5 text-[10px]">ONLINE</Badge>
        {capabilities.safetyCritical && (
          <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">PYRO</Badge>
        )}
      </div>

      <Button size="sm" variant="default" className="h-8 w-full text-xs" onClick={onOpenConsole}>
        <ExternalLink className="mr-1 h-3.5 w-3.5" />
        Abrir controle
      </Button>
    </div>
  );
}

export default GenericControllerCard;
