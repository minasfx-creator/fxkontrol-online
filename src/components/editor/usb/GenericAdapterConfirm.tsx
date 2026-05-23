/**
 * ─── GenericAdapterConfirm — Hold-to-Confirm DMX TX ────────────────
 * UX para destravar transmissão DMX em adapters genéricos (FTDI/CH340
 * sem branding reconhecido). Operador escolhe modo (Open vs Pro) e
 * segura o botão por 1.2 s para confirmar — registra em log de auditoria.
 *
 * Aparece apenas quando: profile.type === 'dmx', authorized, !recognized,
 * e ainda não foi confirmado.
 */

import { useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import { useHoldToConfirm } from '@/hooks/useHoldToConfirm';
import { useUSBDeviceStore } from '@/store/useUSBDeviceStore';
import type { GenericConfirmMode } from '@/core/discovery/portRegistry';
import { toast } from 'sonner';

interface Props {
  deviceId: string;
  deviceLabel: string;
}

export function GenericAdapterConfirm({ deviceId, deviceLabel }: Props) {
  const [mode, setMode] = useState<GenericConfirmMode>('open');
  const confirmGenericAdapter = useUSBDeviceStore(s => s.confirmGenericAdapter);

  const { progress, isHolding, startHold, cancelHold } = useHoldToConfirm({
    duration: 1200,
    hapticOnConfirm: 'arm',
    onConfirm: () => {
      confirmGenericAdapter(deviceId, mode);
      toast.success('Adapter genérico confirmado', {
        description: `${deviceLabel} liberado para TX em modo ${mode === 'pro' ? 'ENTTEC Pro' : 'Open DMX'}`,
        duration: 4000,
      });
    },
  });

  return (
    <div className="border border-amber-500/40 bg-amber-500/5 rounded-sm p-2 space-y-1.5">
      <div className="flex items-start gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
            Adapter genérico (FTDI/CH340)
          </p>
          <p className="text-[8px] text-muted-foreground leading-snug">
            Família não reconhecida. Confirme o protocolo correto antes de transmitir DMX.
            A confirmação fica salva neste navegador para o mesmo VID/PID.
          </p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setMode('open')}
          className={`text-[8px] py-1 rounded-sm border transition-colors ${
            mode === 'open'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-semibold'
              : 'bg-surface-0 text-muted-foreground border-border hover:border-cyan-500/30'
          }`}
        >
          Open DMX
          <span className="block text-[7px] opacity-70">250000 8N2 + BREAK</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('pro')}
          className={`text-[8px] py-1 rounded-sm border transition-colors ${
            mode === 'pro'
              ? 'bg-green-500/20 text-green-300 border-green-500/50 font-semibold'
              : 'bg-surface-0 text-muted-foreground border-border hover:border-green-500/30'
          }`}
        >
          ENTTEC Pro
          <span className="block text-[7px] opacity-70">57600 8N1 wrapper</span>
        </button>
      </div>

      {/* Hold-to-Confirm button */}
      <button
        type="button"
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        className="relative w-full h-9 rounded-sm overflow-hidden bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500/20 transition-colors select-none"
      >
        <div
          className="absolute inset-0 bg-amber-500/40 transition-none"
          style={{ width: `${progress * 100}%` }}
        />
        <div className="relative flex items-center justify-center gap-1.5 h-full">
          <Shield className="h-3 w-3 text-amber-300" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-100">
            {isHolding
              ? `Confirmando... ${Math.round(progress * 100)}%`
              : 'Pressione e segure 1.2 s para liberar'}
          </span>
        </div>
      </button>

      <p className="text-[7px] text-muted-foreground/70 italic leading-snug">
        Risco assumido pelo operador. Ação registrada em log de auditoria.
      </p>
    </div>
  );
}
