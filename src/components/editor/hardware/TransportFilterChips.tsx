/**
 * ─── Transport Filter Chips ────────────────────────────────────────
 * Toggle which transports (Serial, USB, BLE, Art-Net) are visible in
 * the discovery grid and reported via toast notifications.
 *
 * Chips reflect the persisted `useTransportFilters` store so the
 * operator's preference survives reloads.
 */

import { Usb, Bluetooth, Wifi, Cable, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTransportFilters, ALL_TRANSPORTS } from '@/core/discovery/useTransportFilters';
import type { DiscoveryTransport } from '@/core/discovery/types';
import { unifiedDiscovery } from '@/core/discovery/UnifiedDiscoveryService';
import { cn } from '@/lib/utils';

const META: Record<DiscoveryTransport, { label: string; Icon: typeof Usb; tone: string }> = {
  webserial: { label: 'Serial', Icon: Cable, tone: 'cyan' },
  webusb: { label: 'USB', Icon: Usb, tone: 'emerald' },
  webble: { label: 'BLE', Icon: Bluetooth, tone: 'sky' },
  'mdns-artnet': { label: 'Art-Net', Icon: Wifi, tone: 'amber' },
};

const TONE_ON: Record<string, string> = {
  cyan: 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300',
  emerald: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
  sky: 'border-sky-500/50 bg-sky-500/15 text-sky-300',
  amber: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
};

export function TransportFilterChips() {
  const enabled = useTransportFilters(s => s.enabled);
  const toggle = useTransportFilters(s => s.toggle);
  const enableAll = useTransportFilters(s => s.enableAll);
  const support = unifiedDiscovery.supportMatrix();

  const allOn = ALL_TRANSPORTS.every(t => enabled[t] !== false);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[7px] font-mono text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1 mr-1">
        <Filter className="w-2.5 h-2.5" /> Transports
      </span>

      {ALL_TRANSPORTS.map(t => {
        const meta = META[t];
        const on = enabled[t] !== false;
        const supported = support[t];
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            aria-pressed={on}
            title={
              supported
                ? `${meta.label}: ${on ? 'mostrando' : 'oculto'} (clique para alternar)`
                : `${meta.label}: navegador não suporta — pode alternar mesmo assim para limpar toasts`
            }
            className={cn(
              'h-5 px-1.5 rounded border text-[8px] font-mono uppercase tracking-wider gap-1 inline-flex items-center transition-colors',
              on
                ? TONE_ON[meta.tone]
                : 'border-border/30 bg-card/30 text-muted-foreground/50 hover:text-foreground/70',
              !supported && 'opacity-60',
            )}
          >
            <meta.Icon className="w-2.5 h-2.5" />
            {meta.label}
            {!supported && <span className="ml-0.5 text-[7px] opacity-70">n/a</span>}
          </button>
        );
      })}

      {!allOn && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[7px] font-mono text-cyan-400 hover:text-cyan-300"
          onClick={enableAll}
          title="Reativar todos os transportes"
        >
          ALL
        </Button>
      )}
    </div>
  );
}
