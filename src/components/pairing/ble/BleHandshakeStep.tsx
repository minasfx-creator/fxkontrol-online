import { useEffect, useRef } from 'react';
import { Loader2, RefreshCcw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttemptLogList, type PairingAttempt } from './AttemptLogList';

interface Props {
  attempts: PairingAttempt[];
  isHandshaking: boolean;
  deviceName: string;
  onRetry: () => void;
  onPickAnother: () => void;
}

export function BleHandshakeStep({
  attempts, isHandshaking, deviceName, onRetry, onPickAnother,
}: Props) {
  const startedRef = useRef(false);
  // Auto-start the very first handshake when this step mounts.
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      onRetry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/30 bg-card/40 p-5 space-y-2">
        <h2 className="text-base font-bold flex items-center gap-2">
          {isHandshaking && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          Handshake — {deviceName}
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Conectando ao GATT, enviando <span className="font-mono">VERSION</span> +
          <span className="font-mono"> STATUS</span> e aguardando o banner
          <span className="font-mono"> MODEL:FXK16;CH:16;FW:…;ID:…</span>
        </p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Tentativas ({attempts.length})
        </p>
        <AttemptLogList attempts={attempts} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-12 gap-2"
          onClick={onPickAnother}
          disabled={isHandshaking}
        >
          <ArrowLeft className="w-4 h-4" /> Outro dispositivo
        </Button>
        <Button
          className="h-12 gap-2"
          onClick={onRetry}
          disabled={isHandshaking}
        >
          {isHandshaking
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCcw className="w-4 h-4" />}
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}
