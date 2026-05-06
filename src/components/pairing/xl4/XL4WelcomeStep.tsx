/**
 * XL4WelcomeStep — explains scope (read-only handshake on USB-serial dock)
 * and confirms WebSerial availability.
 */
import { Flame, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isWebSerialAvailable, MIN_XL4_FIRMWARE } from '@/lib/fireoneXL4Handshake';

interface Props {
  onContinue: () => void;
}

export function XL4WelcomeStep({ onContinue }: Props) {
  const ready = isWebSerialAvailable();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Flame className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Parear FireOne XL4+</h1>
          <p className="text-sm text-muted-foreground">Handshake read-only via USB-serial</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-4 space-y-2 text-xs">
        <p className="text-muted-foreground leading-relaxed">
          Este pareamento <span className="text-foreground font-semibold">só lê</span>:
          envia <span className="font-mono">IDENTIFY</span>, valida a baud rate,
          aguarda o frame de status e checa o firmware. Nenhum comando de ARM/FIRE
          é emitido — o pyro continua bloqueado até o operador armar pelo console.
        </p>
        <ul className="text-[11px] text-muted-foreground space-y-1 pl-4 list-disc">
          <li>Baud rates suportadas: <span className="font-mono">9600 / 19200 / 38400</span></li>
          <li>Firmware mínimo: <span className="font-mono">{MIN_XL4_FIRMWARE.major}.{MIN_XL4_FIRMWARE.minor.toString().padStart(2, '0')}</span></li>
          <li>Conexão: USB-FTDI / CH340 / CP210x / Prolific</li>
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
