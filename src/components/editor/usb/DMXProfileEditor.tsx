/**
 * ─── DMX Profile Editor ────────────────────────────────────────────
 * Per-device protocol/family pinning. Operator can override the
 * label-based detection (e.g. force a generic FTDI cable to behave as
 * "ENTTEC Open DMX" or "ENTTEC DMX USB Pro" with the widget wrapper).
 *
 * Selection is persisted by VID:PID via `portRegistry` and survives
 * reloads, so this is the long-lived counterpart to the one-time
 * Hold-to-Confirm gate (`GenericAdapterConfirm`).
 */

import { useMemo } from 'react';
import { Settings2, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUSBDeviceStore } from '@/store/useUSBDeviceStore';
import type { DMXProfileOverrideKind } from '@/core/discovery/portRegistry';
import { cn } from '@/lib/utils';

interface DMXProfileEditorProps {
  deviceId: string;
}

interface KindOption {
  value: DMXProfileOverrideKind;
  label: string;
  hint: string;
  isPro: boolean;
}

const OPTIONS: KindOption[] = [
  {
    value: 'enttec-open',
    label: 'ENTTEC Open DMX',
    hint: 'DMX512 direto (sem wrapper). Sem RDM.',
    isPro: false,
  },
  {
    value: 'enttec-pro',
    label: 'ENTTEC DMX USB Pro',
    hint: 'Wrapper widget (label 6). Suporta RDM.',
    isPro: true,
  },
  {
    value: 'dmxking',
    label: 'DMXking ultraDMX',
    hint: 'Compatível com widget ENTTEC (label 6).',
    isPro: true,
  },
  {
    value: 'eurolite',
    label: 'Eurolite USB-DMX512',
    hint: 'DMX512 direto. Sem RDM.',
    isPro: false,
  },
  {
    value: 'generic-dmx',
    label: 'Genérico (FTDI/CH340)',
    hint: 'DMX512 direto sem wrapper. Requer Hold-to-Confirm.',
    isPro: false,
  },
];

export function DMXProfileEditor({ deviceId }: DMXProfileEditorProps) {
  const device = useUSBDeviceStore(s => s.dmxDevices.find(d => d.id === deviceId));
  const setProfileOverride = useUSBDeviceStore(s => s.setProfileOverride);
  const clearProfileOverride = useUSBDeviceStore(s => s.clearProfileOverride);

  const currentValue = useMemo<DMXProfileOverrideKind | undefined>(
    () => device?.profileOverride ?? (device?.recognized ? device.adapterKind as DMXProfileOverrideKind : undefined),
    [device?.profileOverride, device?.recognized, device?.adapterKind],
  );

  if (!device || device.type !== 'dmx') return null;

  const hasOverride = !!device.profileOverride;
  const detectedLabel = device.adapterLabel;

  return (
    <div className="rounded border border-border/40 bg-surface-0/40 p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Settings2 className="w-3 h-3 text-cyan-400" />
        <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-foreground/80">
          Perfil DMX
        </span>
        {hasOverride ? (
          <Badge variant="outline" className="ml-auto h-3.5 text-[6.5px] px-1 border-cyan-500/40 text-cyan-400 gap-0.5">
            <ShieldCheck className="w-2 h-2" /> OVERRIDE
          </Badge>
        ) : (
          <Badge variant="outline" className="ml-auto h-3.5 text-[6.5px] px-1 border-border/40 text-muted-foreground">
            AUTO
          </Badge>
        )}
      </div>

      <Select
        value={currentValue ?? ''}
        onValueChange={(v) => setProfileOverride(deviceId, v as DMXProfileOverrideKind)}
      >
        <SelectTrigger className="h-7 text-[9px] font-mono bg-surface-0">
          <SelectValue placeholder="Selecionar perfil…" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          {OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value} className="text-[10px] font-mono">
              <div className="flex flex-col">
                <span className="font-bold">{opt.label}</span>
                <span className="text-[8px] text-muted-foreground">{opt.hint}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center justify-between gap-1">
        <span className="text-[7.5px] font-mono text-muted-foreground/80 truncate">
          Detectado: <span className="text-foreground/70">{detectedLabel}</span>
          {' · '}
          <span className={cn(device.isENTTECPro ? 'text-green-400' : 'text-cyan-400')}>
            {device.protocol}
          </span>
        </span>
        {hasOverride && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[7.5px] font-mono gap-0.5 text-amber-400 hover:text-amber-300"
            onClick={() => clearProfileOverride(deviceId)}
            title="Voltar para detecção automática pelo label do dispositivo"
          >
            <RotateCcw className="w-2.5 h-2.5" /> AUTO
          </Button>
        )}
      </div>
    </div>
  );
}
