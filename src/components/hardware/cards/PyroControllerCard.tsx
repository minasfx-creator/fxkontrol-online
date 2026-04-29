/**
 * ─── PyroControllerCard — extracted unchanged from launcher v1 ─────
 * Behavior identical to the previous inline component. ARM hold-800ms,
 * TEST CH1 hold-800ms, instant E-STOP, deep-link to console.
 */
import { useCallback } from 'react';
import { X, Flame, Lock, Unlock, ExternalLink, Power, Bluetooth, Usb, Network, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ActiveController } from '@/hooks/useActiveControllers';
import { useFXK16Commands } from '@/hooks/useFXK16Commands';
import { HoldToConfirmButton } from '../shared/HoldToConfirmButton';
import type { DiscoveryTransport } from '@/core/discovery/types';

const HOLD_MS = 800;
const PULSE_MS = 50;

function TransportIcon({ transport }: { transport: DiscoveryTransport | null }) {
  const cls = 'h-3.5 w-3.5';
  if (transport === 'webserial') return <Usb className={cls} aria-label="USB Serial" />;
  if (transport === 'webusb') return <Usb className={cls} aria-label="USB" />;
  if (transport === 'webble') return <Bluetooth className={cls} aria-label="BLE" />;
  if (transport === 'mdns-artnet') return <Network className={cls} aria-label="Art-Net" />;
  return <Wifi className={cls} aria-label="Link" />;
}

export interface PyroControllerCardProps {
  controller: ActiveController;
  onClose: () => void;
  onOpenConsole: () => void;
}

export function PyroControllerCard({ controller, onClose, onOpenConsole }: PyroControllerCardProps) {
  const { api, armed, ready } = useFXK16Commands();

  const onArm = useCallback(() => {
    if (armed) {
      const r = api.disarm();
      if (r.ok === true) toast.success('DISARMED');
      else toast.error(`DISARM falhou: ${r.message}`);
      return;
    }
    const r = api.arm();
    if (r.ok === true) toast.success('ARMED — pronto para disparar');
    else toast.error(`ARM falhou: ${r.message}`);
  }, [api, armed]);

  const onFireTest = useCallback(async () => {
    if (!armed) {
      toast.warning('ARM antes de testar disparo');
      return;
    }
    const r = await api.fire(1, PULSE_MS);
    if (r.ok === true) toast.success('FIRE CH1 ✓');
    else toast.error(`FIRE falhou: ${r.message}`);
  }, [api, armed]);

  const onEStop = useCallback(async () => {
    const r = await api.stop();
    if (r.ok === true) toast.success('E-STOP enviado — desarmado');
    else toast.error(`E-STOP falhou: ${r.message}`);
  }, [api]);

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 shadow-xl backdrop-blur min-w-[280px] max-w-[320px]',
        armed
          ? 'border-destructive shadow-[0_0_24px_-8px_hsl(var(--destructive)/0.8)]'
          : 'border-border',
      )}
      role="region"
      aria-label={`Controller: ${controller.profile.label}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Flame className={cn('h-4 w-4', armed ? 'text-destructive' : 'text-primary')} />
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

      <div className="mb-2 flex flex-wrap items-center gap-1">
        <Badge variant={ready ? 'default' : 'outline'} className="h-5 px-1.5 text-[10px]">
          {ready ? 'READY' : 'LINK'}
        </Badge>
        {armed && (
          <Badge variant="destructive" className="h-5 px-1.5 text-[10px] uppercase">ARMED</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <HoldToConfirmButton
          holdMs={HOLD_MS}
          onConfirm={onArm}
          onTap={armed ? onArm : undefined}
          disabled={!ready}
          variant={armed ? 'destructive' : 'outline'}
          ariaLabel={armed ? 'Disarm' : 'Arm'}
        >
          {armed ? <Unlock className="mr-1 h-3.5 w-3.5" /> : <Lock className="mr-1 h-3.5 w-3.5" />}
          {armed ? 'DISARM' : 'ARM'}
        </HoldToConfirmButton>

        <HoldToConfirmButton
          holdMs={HOLD_MS}
          onConfirm={onFireTest}
          disabled={!ready || !armed}
          variant="outline"
          className={cn(armed && 'border-destructive text-destructive hover:bg-destructive/10')}
          ariaLabel="Test fire channel 1"
        >
          <Flame className="mr-1 h-3.5 w-3.5" />
          TEST CH1
        </HoldToConfirmButton>
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={onEStop}>
          <Power className="mr-1 h-3.5 w-3.5" />
          E-STOP
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onOpenConsole}>
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          Console
        </Button>
      </div>
    </div>
  );
}

export default PyroControllerCard;
