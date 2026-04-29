/**
 * ─── DmxControllerCard — direct BLACKOUT/HOLD ON for DMX devices ───
 * Inline actions for ENTTEC / dmx-generic / artnet-node profiles.
 * Always shows BLACKOUT (instant tap, destructive — DMX has no ARM),
 * HOLD ON 100% (1s), and a universe selector when more than one is
 * registered. The optional ALL BLACKOUT covers every registered
 * universe (also instant tap).
 *
 * Honest-hardware: when no DMX universe is registered yet,
 * `dmxQuickActions` returns NO_UNIVERSE and we surface that instead of
 * pretending the bus reset.
 */
import { useCallback, useMemo, useState } from 'react';
import { X, ZapOff, Sun, ExternalLink, Bluetooth, Usb, Network, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { ActiveController } from '@/hooks/useActiveControllers';
import { dmxQuickActions } from '@/core/hardware/dmxQuickActions';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { DiscoveryTransport } from '@/core/discovery/types';

function TransportIcon({ transport }: { transport: DiscoveryTransport | null }) {
  const cls = 'h-3.5 w-3.5';
  if (transport === 'webserial' || transport === 'webusb') return <Usb className={cls} />;
  if (transport === 'webble') return <Bluetooth className={cls} />;
  if (transport === 'mdns-artnet') return <Network className={cls} />;
  return <Wifi className={cls} />;
}

export interface DmxControllerCardProps {
  controller: ActiveController;
  onClose: () => void;
  onOpenConsole: () => void;
}

export function DmxControllerCard({ controller, onClose, onOpenConsole }: DmxControllerCardProps) {
  const dev = controller.device;
  const universes = useMemo(() => dmxQuickActions.listUniverses(), []);
  const [selected, setSelected] = useState<number | null>(
    universes.length > 0 ? universes[0].id : null,
  );

  const onBlackout = useCallback(() => {
    if (selected == null) {
      toast.error('Nenhum universo DMX registrado');
      return;
    }
    const r = dmxQuickActions.blackout(selected);
    if (r.ok === true) toast.success(`BLACKOUT universo ${selected} ✓`);
    else toast.error(r.message);
  }, [selected]);

  const onBlackoutAll = useCallback(() => {
    const r = dmxQuickActions.blackout();
    if (r.ok === true) toast.success('BLACKOUT em todos os universos ✓');
    else toast.error(r.message);
  }, []);

  const onHoldOn = useCallback(() => {
    if (selected == null) {
      toast.error('Selecione um universo');
      return;
    }
    const r = dmxQuickActions.holdOn100(selected, 1000);
    if (r.ok === true) toast.success(`HOLD ON 100% u${selected} (1s)`);
    else toast.error(r.message);
  }, [selected]);

  return (
    <div
      className="min-w-[280px] max-w-[320px] rounded-lg border border-border bg-card p-3 shadow-xl backdrop-blur"
      role="region"
      aria-label={`DMX device: ${controller.profile.label}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" />
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
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {universes.length} universo{universes.length === 1 ? '' : 's'}
        </Badge>
      </div>

      {universes.length > 1 && (
        <div className="mb-1.5">
          <Select
            value={selected?.toString() ?? ''}
            onValueChange={(v) => setSelected(Number(v))}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Universo" />
            </SelectTrigger>
            <SelectContent>
              {universes.map((u) => (
                <SelectItem key={u.id} value={u.id.toString()} className="text-xs">
                  U{u.id} — {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <Button
          size="sm"
          variant="destructive"
          className="h-8 text-xs"
          onClick={onBlackout}
          disabled={universes.length === 0}
          aria-label="Blackout universe"
        >
          <ZapOff className="mr-1 h-3.5 w-3.5" />
          BLACKOUT
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={onHoldOn}
          disabled={universes.length === 0}
          aria-label="Hold on 100 percent"
        >
          <Sun className="mr-1 h-3.5 w-3.5" />
          HOLD 100%
        </Button>
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Button
          size="sm"
          variant="destructive"
          className="h-8 text-xs"
          onClick={onBlackoutAll}
          disabled={universes.length === 0}
        >
          <ZapOff className="mr-1 h-3.5 w-3.5" />
          ALL BLACK
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onOpenConsole}>
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          Console
        </Button>
      </div>
    </div>
  );
}

export default DmxControllerCard;
