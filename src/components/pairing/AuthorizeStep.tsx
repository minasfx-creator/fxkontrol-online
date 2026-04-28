import { useState } from 'react';
import { ShieldCheck, Loader2, AlertCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requestSerialPort, USBConnectionError } from '@/lib/usbEngine';
import type { AuthorizedDevice } from '@/pages/UsbPairingWizard';

interface Props {
  onBack: () => void;
  onAuthorized: (device: AuthorizedDevice) => void;
  onError: (err: USBConnectionError) => void;
}

export function AuthorizeStep({ onBack, onAuthorized, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<USBConnectionError | null>(null);

  const handleAuthorize = async () => {
    setBusy(true);
    setErr(null);
    try {
      const port = await requestSerialPort();
      // Extract identity. SerialPort.getInfo() returns vid/pid; serialNumber not always exposed.
      const info: { usbVendorId?: number; usbProductId?: number } =
        typeof port?.getInfo === 'function' ? port.getInfo() : {};
      const device: AuthorizedDevice = {
        port,
        vendorId: info.usbVendorId,
        productId: info.usbProductId,
        label: buildLabel(info.usbVendorId, info.usbProductId),
        transport: 'webserial',
      };
      onAuthorized(device);
    } catch (e) {
      const ce = e instanceof USBConnectionError
        ? e
        : new USBConnectionError((e as Error)?.message ?? 'Erro desconhecido', 'unknown');
      setErr(ce);
      onError(ce);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Autorizar dispositivo</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Toque no botão abaixo. O sistema mostrará uma janela para você selecionar o acessório.
        </p>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
        <div className="h-16 w-16 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mb-4">
          {busy ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : (
            <ShieldCheck className="w-8 h-8 text-primary" />
          )}
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          {busy
            ? 'Aguardando seleção do dispositivo na janela do sistema...'
            : 'Pronto para receber a autorização do operador.'}
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-semibold text-destructive">{err.message}</p>
              {err.hint && (
                <p className="text-xs text-muted-foreground leading-relaxed">{err.hint}</p>
              )}
              <p className="text-[10px] font-mono text-muted-foreground/60">code: {err.code}</p>
            </div>
          </div>
        </div>
      )}

      <Button
        onClick={handleAuthorize}
        disabled={busy}
        className="w-full min-h-[64px] text-base gap-2"
        variant="default"
      >
        {busy ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Aguardando...
          </>
        ) : err ? (
          <>
            <RotateCcw className="w-5 h-5" />
            Tentar novamente
          </>
        ) : (
          <>
            <ShieldCheck className="w-5 h-5" />
            AUTORIZAR DISPOSITIVO
          </>
        )}
      </Button>

      <Button variant="ghost" onClick={onBack} disabled={busy} className="w-full gap-1">
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </Button>
    </div>
  );
}

function buildLabel(vid?: number, pid?: number): string {
  if (vid === undefined && pid === undefined) return 'Dispositivo Serial';
  const vh = vid?.toString(16).padStart(4, '0').toUpperCase() ?? 'xxxx';
  const ph = pid?.toString(16).padStart(4, '0').toUpperCase() ?? 'xxxx';
  return `USB ${vh}:${ph}`;
}
