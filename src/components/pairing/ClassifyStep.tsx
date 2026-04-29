import { useMemo, useState } from 'react';
import { Check, ArrowRight, ArrowLeft, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEVICE_PROFILES, type USBDeviceProfile } from '@/lib/usbEngine';
import type { AuthorizedDevice } from '@/pages/UsbPairingWizard';

interface Props {
  device: AuthorizedDevice;
  onBack: () => void;
  onConfirm: (profile: USBDeviceProfile) => void;
}

/** Auto-suggest a profile based on VID/PID known mapping. */
function suggestProfile(vid?: number, pid?: number): USBDeviceProfile {
  if (vid !== undefined && pid !== undefined) {
    const exact = DEVICE_PROFILES.find(p => p.vendorId === vid && p.productId === pid);
    if (exact) return exact;
  }
  // Fallback: generic serial.
  return DEVICE_PROFILES.find(p => p.type === 'serial') ?? DEVICE_PROFILES[0];
}

export function ClassifyStep({ device, onBack, onConfirm }: Props) {
  const suggested = useMemo(
    () => suggestProfile(device.vendorId, device.productId),
    [device.vendorId, device.productId],
  );
  const [selectedLabel, setSelectedLabel] = useState<string>(suggested.label);

  const selected = DEVICE_PROFILES.find(p => p.label === selectedLabel) ?? suggested;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Classificar protocolo</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o protocolo correto para este acessório.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
            <Check className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-emerald-300">Dispositivo autorizado</p>
            <p className="text-sm font-mono truncate">{device.label}</p>
            <div className="flex gap-3 text-[10px] font-mono text-muted-foreground">
              <span>VID: {device.vendorId !== undefined ? `0x${device.vendorId.toString(16).padStart(4, '0').toUpperCase()}` : '—'}</span>
              <span>PID: {device.productId !== undefined ? `0x${device.productId.toString(16).padStart(4, '0').toUpperCase()}` : '—'}</span>
              <span>via {device.transport}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Protocolo
        </label>
        <Select value={selectedLabel} onValueChange={setSelectedLabel}>
          <SelectTrigger className="min-h-[56px] text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEVICE_PROFILES.map(p => (
              <SelectItem key={p.label} value={p.label}>
                <div className="flex flex-col">
                  <span className="font-medium">{p.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {p.baudRate} baud · {p.type.toUpperCase()}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {suggested.label === selectedLabel && (
          <p className="text-[11px] text-primary flex items-center gap-1">
            <Cpu className="w-3 h-3" /> Sugerido automaticamente pelo VID/PID
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border/40 bg-card/30 p-3 space-y-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Configuração serial</p>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="flex justify-between"><span className="text-muted-foreground">Baud</span><span>{selected.baudRate}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span>{selected.dataBits ?? 8}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Stop</span><span>{selected.stopBits ?? 1}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Parity</span><span>{selected.parity ?? 'none'}</span></div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="min-h-[56px] flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Button onClick={() => onConfirm(selected)} className="min-h-[56px] flex-1 gap-2">
          Confirmar e registrar
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
