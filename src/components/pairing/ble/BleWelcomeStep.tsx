import { Bluetooth, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { detectPlatformCapabilities, platformLabel } from '@/lib/platformCapabilities';
import { isWebBluetoothSupported } from '@/lib/fxk16BleHandshake';

interface Props { onNext: () => void }

export function BleWelcomeStep({ onNext }: Props) {
  const navigate = useNavigate();
  const caps = detectPlatformCapabilities();
  const supported = isWebBluetoothSupported() && (caps.webBle || caps.capacitorBle);
  const isIOS = caps.platform === 'ios-safari-pwa' || caps.platform === 'ios-capacitor';

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5 text-center space-y-3">
        <div className="h-14 w-14 mx-auto rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
          <Bluetooth className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-base font-bold">Pareamento BLE — FXK16</h2>
        <p className="text-xs text-muted-foreground leading-relaxed px-2">
          Vamos buscar módulos <span className="font-mono text-primary">FXK16-XXXXXX</span> próximos,
          conectar via Bluetooth e ler o handshake do firmware. Apenas leitura — nenhum disparo é enviado.
        </p>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-2 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Plataforma detectada</span>
          <span className="font-mono">{platformLabel(caps.platform)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Web Bluetooth</span>
          <span className={supported ? 'text-emerald-400 font-mono' : 'text-red-400 font-mono'}>
            {supported ? 'disponível' : 'indisponível'}
          </span>
        </div>
      </div>

      {!supported && isIOS && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-200 leading-relaxed">
              Web Bluetooth não está disponível no Safari/iOS. Use o pareamento USB
              (cabo Lightning/USB-C) ou um build nativo Capacitor com plugin BLE.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full h-12 border-amber-500/40 text-amber-200"
            onClick={() => navigate('/pairing/usb')}
          >
            Ir para pareamento USB
          </Button>
        </div>
      )}

      {!supported && !isIOS && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-red-200 leading-relaxed">
              Este navegador não suporta Web Bluetooth. Use Chrome/Edge no Android ou desktop,
              ou conecte via cabo USB.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-[10px] text-emerald-200/80 leading-relaxed">
          Read-only handshake. O wizard só identifica o módulo. Disparo continua passando pela
          cadeia ShowPlan → CommandBus → SafetyStateMachine.
        </p>
      </div>

      <Button
        className="w-full h-14 text-sm gap-2"
        onClick={onNext}
        disabled={!supported}
      >
        Começar busca <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
