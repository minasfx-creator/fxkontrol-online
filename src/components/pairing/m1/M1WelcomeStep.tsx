/**
 * M1WelcomeStep — explains scope (read-only PBus STATUS handshake)
 * and confirms WebSerial availability.
 */
import { Radio, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isWebSerialAvailable, MIN_M1_FIRMWARE, M1_BAUD } from '@/lib/showvenM1Handshake';

interface Props {
  onContinue: () => void;
}

export function M1WelcomeStep({ onContinue }: Props) {
  const ready = isWebSerialAvailable();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Radio className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Parear Showven M1</h1>
          <p className="text-sm text-muted-foreground">Handshake PBus read-only · 128 cues</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-4 space-y-2 text-xs">
        <p className="text-muted-foreground leading-relaxed">
          Este pareamento <span className="text-foreground font-semibold">só lê</span>: envia
          <span className="font-mono"> STATUS</span> via PBus, valida CRC + firmware e
          identifica os slaves (C16/X4) no barramento. Nenhum ARM/FIRE é emitido —
          o pyro continua bloqueado até o operador armar pelo console.
        </p>
        <ul className="text-[11px] text-muted-foreground space-y-1 pl-4 list-disc">
          <li>Baud fixo: <span className="font-mono">{M1_BAUD} 8N1</span> (PBus dual-band)</li>
          <li>Firmware mínimo: <span className="font-mono">V{MIN_M1_FIRMWARE.major}.{MIN_M1_FIRMWARE.minor}</span> (FXcommander baseline)</li>
          <li>Conexão: USB-FTDI / CH340 / CP210x / Prolific</li>
          <li>Master address default: <span className="font-mono">1</span></li>
        </ul>
      </div>

      {!ready && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            WebSerial indisponível. Use Chrome/Edge desktop ou o app nativo.
          </p>
        </div>
      )}

      {ready && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-300">WebSerial pronto.</p>
        </div>
      )}

      <Button
        onClick={onContinue}
        disabled={!ready}
        className="w-full min-h-[56px] gap-2 text-base"
      >
        Começar pareamento
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
