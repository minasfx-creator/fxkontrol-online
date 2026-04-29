/**
 * AttemptLogList — chronological per-attempt status panel for the BLE
 * pairing wizard. Pure presentational; data is owned by the page.
 */
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HandshakeFailureCode } from '@/lib/fxk16BleHandshake';

export type AttemptOutcome =
  | { kind: 'pending' }
  | { kind: 'connecting' }
  | { kind: 'ok'; raw: string; latencyMs: number; firmware?: string; deviceId?: string }
  | { kind: 'error'; code: HandshakeFailureCode; message: string; latencyMs: number };

export interface PairingAttempt {
  id: string;
  startedAt: number;
  deviceName: string;
  outcome: AttemptOutcome;
}

interface Props {
  attempts: PairingAttempt[];
  /** Most recent first. */
  newestFirst?: boolean;
}

const codeLabel: Record<HandshakeFailureCode, string> = {
  unsupported: 'Não suportado',
  cancelled: 'Cancelado',
  'gatt-failed': 'Erro GATT',
  timeout: 'Timeout',
  'bad-banner': 'Banner inválido',
  disconnected: 'Desconectado',
  unknown: 'Erro',
};

export function AttemptLogList({ attempts, newestFirst = true }: Props) {
  if (attempts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/40 bg-card/30 p-4 text-center">
        <p className="text-[11px] text-muted-foreground font-mono">
          Nenhuma tentativa ainda — toque em <span className="text-primary">Buscar FXK16</span>.
        </p>
      </div>
    );
  }
  const ordered = newestFirst ? [...attempts].reverse() : attempts;
  return (
    <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {ordered.map((a) => {
        const ts = new Date(a.startedAt).toLocaleTimeString('pt-BR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        const o = a.outcome;
        return (
          <li
            key={a.id}
            className={cn(
              'rounded-lg border bg-card/40 backdrop-blur p-3 flex items-start gap-3',
              o.kind === 'ok' && 'border-emerald-500/40',
              o.kind === 'error' && 'border-red-500/40',
              (o.kind === 'pending' || o.kind === 'connecting') && 'border-amber-500/40',
            )}
          >
            <div className="mt-0.5 shrink-0">
              {o.kind === 'ok' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {o.kind === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
              {o.kind === 'connecting' && <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />}
              {o.kind === 'pending' && <Clock className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-mono font-semibold truncate">{a.deviceName}</p>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">{ts}</span>
              </div>
              {o.kind === 'ok' && (
                <>
                  <p className="text-[11px] text-emerald-300 font-mono">
                    Handshake OK — {o.latencyMs}ms{o.firmware ? ` • FW ${o.firmware}` : ''}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono break-all">{o.raw}</p>
                </>
              )}
              {o.kind === 'error' && (
                <>
                  <p className="text-[11px] text-red-300 font-mono">
                    {codeLabel[o.code]} — {o.latencyMs}ms
                  </p>
                  <p className="text-[10px] text-muted-foreground break-words">{o.message}</p>
                </>
              )}
              {o.kind === 'connecting' && (
                <p className="text-[11px] text-amber-300 font-mono">Conectando…</p>
              )}
              {o.kind === 'pending' && (
                <p className="text-[11px] text-muted-foreground font-mono">Aguardando…</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
