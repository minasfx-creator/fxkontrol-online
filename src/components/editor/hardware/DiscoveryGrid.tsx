/**
 * ─── DiscoveryGrid — Real Hardware Transports Matrix ───────────────
 * Live snapshot of every transport-specific discoverer. Shows support
 * status, device count, and a per-device list with VID:PID + family.
 */

import { useEffect, useState } from 'react';
import { Usb, Bluetooth, Wifi, Cable, AlertTriangle } from 'lucide-react';
import { unifiedDiscovery } from '@/core/discovery/UnifiedDiscoveryService';
import { useTransportFilters } from '@/core/discovery/useTransportFilters';
import type { DiscoveredDevice, DiscoveryTransport } from '@/core/discovery/types';
import { DiscoveryDeviceDrawer } from './DiscoveryDeviceDrawer';
import { cn } from '@/lib/utils';

const TRANSPORT_META: Record<DiscoveryTransport, { label: string; Icon: typeof Usb; tone: string }> = {
  webserial: { label: 'Serial', Icon: Cable, tone: 'cyan' },
  webusb: { label: 'USB', Icon: Usb, tone: 'emerald' },
  webble: { label: 'BLE', Icon: Bluetooth, tone: 'sky' },
  'mdns-artnet': { label: 'Art-Net', Icon: Wifi, tone: 'amber' },
};

const TONE_BG: Record<string, string> = {
  cyan: 'border-cyan-500/30 bg-cyan-500/5',
  emerald: 'border-emerald-500/30 bg-emerald-500/5',
  sky: 'border-sky-500/30 bg-sky-500/5',
  amber: 'border-amber-500/30 bg-amber-500/5',
};

const TONE_TEXT: Record<string, string> = {
  cyan: 'text-cyan-400',
  emerald: 'text-emerald-400',
  sky: 'text-sky-400',
  amber: 'text-amber-400',
};

export function DiscoveryGrid() {
  const [devices, setDevices] = useState<DiscoveredDevice[]>(unifiedDiscovery.getDevices());
  const [selected, setSelected] = useState<DiscoveredDevice | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const support = unifiedDiscovery.supportMatrix();
  const enabled = useTransportFilters(s => s.enabled);

  useEffect(() => {
    setDevices(unifiedDiscovery.getDevices());
    return unifiedDiscovery.watch(() => setDevices(unifiedDiscovery.getDevices()));
  }, []);

  // Keep the selected snapshot in sync with new discovery events.
  useEffect(() => {
    if (!selected) return;
    const fresh = devices.find(d => d.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [devices, selected]);

  const openDrawer = (d: DiscoveredDevice) => {
    setSelected(d);
    setDrawerOpen(true);
  };

  useEffect(() => {
    setDevices(unifiedDiscovery.getDevices());
    return unifiedDiscovery.watch(() => setDevices(unifiedDiscovery.getDevices()));
  }, []);

  const transports: DiscoveryTransport[] = (
    ['webserial', 'webusb', 'webble', 'mdns-artnet'] as DiscoveryTransport[]
  ).filter(t => enabled[t] !== false);

  if (transports.length === 0) {
    return (
      <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[8px] font-mono text-amber-300/90 text-center">
        Todos os transportes estão filtrados. Reative pelo menos um nos chips acima.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {transports.map(t => {
        const meta = TRANSPORT_META[t];
        const supported = support[t];
        const list = devices.filter(d => d.transport === t);
        return (
          <div
            key={t}
            className={cn(
              'rounded border p-2 flex flex-col gap-1.5 min-h-[5.5rem]',
              supported ? TONE_BG[meta.tone] : 'border-border/20 bg-card/20 opacity-60',
            )}
          >
            <div className="flex items-center gap-1.5">
              <meta.Icon className={cn('w-3 h-3', supported ? TONE_TEXT[meta.tone] : 'text-muted-foreground/40')} />
              <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-foreground/80">
                {meta.label}
              </span>
              <span className={cn(
                'text-[7px] font-mono ml-auto px-1 rounded',
                supported ? `${TONE_TEXT[meta.tone]} bg-foreground/5` : 'text-muted-foreground/40',
              )}>
                {supported ? `${list.length} dev` : 'n/a'}
              </span>
            </div>

            {!supported && (
              <span className="text-[7px] font-mono text-muted-foreground/50">
                Não suportado neste navegador
              </span>
            )}

            {supported && list.length === 0 && (
              <span className="text-[7px] font-mono text-muted-foreground/50">Nenhum autorizado</span>
            )}

            <div className="space-y-0.5 max-h-24 overflow-y-auto scrollbar-thin">
              {list.map(d => (
                <div
                  key={d.id}
                  className="text-[7px] font-mono leading-tight flex items-start gap-1"
                  title={d.id}
                >
                  <span className={cn(
                    'w-1 h-1 rounded-full mt-1 shrink-0',
                    d.online ? 'bg-emerald-400' : 'bg-muted-foreground/40',
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-foreground/80">{d.label}</div>
                    <div className="text-muted-foreground/60">
                      {d.vendorId != null && d.productId != null
                        ? `${d.vendorId.toString(16).padStart(4, '0')}:${d.productId.toString(16).padStart(4, '0')}`
                        : d.host ?? d.family ?? '—'}
                      {' · '}
                      <span className={d.recognized ? TONE_TEXT[meta.tone] : 'text-amber-400/80'}>
                        {d.recognized ? 'reconhecido' : 'genérico'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
