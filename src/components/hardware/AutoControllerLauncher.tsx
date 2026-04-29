/**
 * ─── AutoControllerLauncher — global hardware overlay ─────────────
 * Floats a small card at the bottom-right of every authenticated route
 * whenever a recognised module/equipment becomes online. The card is
 * the operator's instant entry point: ARM / FIRE TEST / E-STOP for
 * pyro controllers, "Open console" deep-link for everything else.
 *
 * Driven by `useActiveControllers`, which observes the device
 * aggregator. Multiple devices stack vertically. The operator can
 * dismiss a card (×) to hide it without disconnecting the device — a
 * fresh `link-recovered` event re-surfaces it.
 *
 * Honest-hardware: never auto-arms, never auto-fires. Just opens the
 * controller surface and waits for the operator. ARM is always
 * Hold-to-Confirm via the typed FXK16 command API.
 */
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Flame, Lock, Unlock, ExternalLink, Power, AlertTriangle,
  Bluetooth, Usb, Network, Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useActiveControllers,
  type ActiveController,
} from '@/hooks/useActiveControllers';
import { useFXK16Commands } from '@/hooks/useFXK16Commands';
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

/** Card body for FXK16 / FireOne / Showven (pyro, safety-critical). */
function PyroControllerCard({
  controller,
  onClose,
  onOpenConsole,
}: {
  controller: ActiveController;
  onClose: () => void;
  onOpenConsole: () => void;
}) {
  const { api, armed, ready } = useFXK16Commands();
  const [holding, setHolding] = useState<'arm' | 'fire' | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHold = useCallback(() => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    setHolding(null);
  }, []);

  const startArmHold = useCallback(() => {
    if (armed) {
      const r = api.disarm();
      if (r.ok === true) toast.success('DISARMED');
      else toast.error(`DISARM falhou: ${r.message}`);
      return;
    }
    setHolding('arm');
    holdTimer.current = setTimeout(() => {
      const r = api.arm();
      if (r.ok === true) toast.success('ARMED — pronto para disparar');
      else toast.error(`ARM falhou: ${r.message}`);
      clearHold();
    }, HOLD_MS);
  }, [api, armed, clearHold]);

  const startFireHold = useCallback(() => {
    if (!armed) {
      toast.warning('ARM antes de testar disparo');
      return;
    }
    setHolding('fire');
    holdTimer.current = setTimeout(async () => {
      const r = await api.fire(1, PULSE_MS);
      if (r.ok === true) toast.success('FIRE CH1 ✓');
      else toast.error(`FIRE falhou: ${r.message}`);
      clearHold();
    }, HOLD_MS);
  }, [api, armed, clearHold]);

  const onEStop = useCallback(async () => {
    const r = await api.stop();
    if (r.ok === true) toast.success('E-STOP enviado — desarmado');
    else toast.error(`E-STOP falhou: ${r.message}`);
  }, [api]);

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 shadow-xl backdrop-blur',
        'min-w-[280px] max-w-[320px]',
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
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1">
        <Badge variant={ready ? 'default' : 'outline'} className="h-5 px-1.5 text-[10px]">
          {ready ? 'READY' : 'LINK'}
        </Badge>
        {armed && (
          <Badge variant="destructive" className="h-5 px-1.5 text-[10px] uppercase">
            ARMED
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Button
          size="sm"
          variant={armed ? 'destructive' : 'outline'}
          className="h-8 text-xs"
          onMouseDown={startArmHold}
          onMouseUp={clearHold}
          onMouseLeave={clearHold}
          onTouchStart={startArmHold}
          onTouchEnd={clearHold}
          disabled={!ready}
        >
          {armed ? <Unlock className="mr-1 h-3.5 w-3.5" /> : <Lock className="mr-1 h-3.5 w-3.5" />}
          {holding === 'arm' ? 'Segure…' : armed ? 'DISARM' : 'ARM'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            'h-8 text-xs',
            armed && 'border-destructive text-destructive hover:bg-destructive/10',
          )}
          onMouseDown={startFireHold}
          onMouseUp={clearHold}
          onMouseLeave={clearHold}
          onTouchStart={startFireHold}
          onTouchEnd={clearHold}
          disabled={!ready || !armed}
        >
          <Flame className="mr-1 h-3.5 w-3.5" />
          {holding === 'fire' ? 'Segure…' : 'TEST CH1'}
        </Button>
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Button
          size="sm"
          variant="destructive"
          className="h-8 text-xs"
          onClick={onEStop}
        >
          <Power className="mr-1 h-3.5 w-3.5" />
          E-STOP
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={onOpenConsole}
        >
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          Console
        </Button>
      </div>
    </div>
  );
}

/** Card body for non-pyro controllers (Tuya, DMX, Art-Net, etc.). */
function GenericControllerCard({
  controller,
  onClose,
  onOpenConsole,
}: {
  controller: ActiveController;
  onClose: () => void;
  onOpenConsole: () => void;
}) {
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
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        <Badge variant="default" className="h-5 px-1.5 text-[10px]">ONLINE</Badge>
        {capabilities.safetyCritical && (
          <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">PYRO</Badge>
        )}
      </div>

      <Button
        size="sm"
        variant="default"
        className="h-8 w-full text-xs"
        onClick={onOpenConsole}
      >
        <ExternalLink className="mr-1 h-3.5 w-3.5" />
        Abrir controle
      </Button>
    </div>
  );
}

export function AutoControllerLauncher() {
  const { pending, acknowledge } = useActiveControllers();
  const navigate = useNavigate();

  if (pending.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2"
      aria-live="polite"
    >
      {pending.map((c) => {
        const isPyro = c.profile.kind === 'fxk16'
          || c.profile.kind === 'fireone'
          || c.profile.kind === 'showven';
        const open = () => {
          if (c.profile.consoleRoute) navigate(c.profile.consoleRoute);
          acknowledge(c.aggregateId);
        };
        return (
          <div key={c.aggregateId} className="pointer-events-auto">
            {isPyro ? (
              <PyroControllerCard
                controller={c}
                onClose={() => acknowledge(c.aggregateId)}
                onOpenConsole={open}
              />
            ) : (
              <GenericControllerCard
                controller={c}
                onClose={() => acknowledge(c.aggregateId)}
                onOpenConsole={open}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default AutoControllerLauncher;
