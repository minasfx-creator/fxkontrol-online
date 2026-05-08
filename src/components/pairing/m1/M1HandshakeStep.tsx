/**
 * M1HandshakeStep — runs `performM1Handshake` (PBus STATUS) and renders
 * a per-attempt log (latency, error code, FW). Advances only on a
 * fully validated reply with firmware ≥ V1.5.
 */
import { useEffect, useRef } from 'react';
import { Loader2, RefreshCcw, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ShowvenM1HandshakeFailureCode } from '@/lib/showvenM1Handshake';

export type M1AttemptOutcome =
  | { kind: 'connecting' }
  | { kind: 'ok'; latencyMs: number; firmware: string; masterAddress: number; slavesOnline: number; raw: string }
  | { kind: 'error'; code: ShowvenM1HandshakeFailureCode; message: string; latencyMs: number };

export interface M1Attempt {
  id: string;
  startedAt: number;
  masterAddress: number;
  outcome: M1AttemptOutcome;
}

interface Props {
  masterAddress: number;
  attempts: M1Attempt[];
  isHandshaking: boolean;
  onRetry: () => void;
  onChangeAddress: () => void;
}

const codeLabel: Record<ShowvenM1HandshakeFailureCode, string> = {
  unsupported: 'Sem WebSerial',
  cancelled: 'Cancelado',
  'open-failed': 'Falha ao abrir porta',
  'write-failed': 'Falha ao escrever',
  timeout: 'Timeout',
  'bad-frame': 'Frame inválido',
  'firmware-too-old': 'Firmware obsoleto',
  'wrong-model': 'Modelo incorreto',
  unknown: 'Erro',
};

export function M1HandshakeStep({ masterAddress, attempts, isHandshaking, onRetry, onChangeAddress }: Props) {
  const startedRef = useRef(false);
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      onRetry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ordered = [...attempts].reverse();

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/30 bg-card/40 p-5 space-y-2">
        <h2 className="text-base font-bold flex items-center gap-2">
          {isHandshaking && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          Handshake — Showven M1
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          PBus <span className="font-mono text-foreground">19200 8N1</span> · enviando
          <span className="font-mono"> STATUS</span> ao master <span className="font-mono">addr {masterAddress}</span>
          e validando CRC + firmware.
        </p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Tentativas ({attempts.length})
        </p>
        {attempts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 bg-card/30 p-4 text-center">
            <p className="text-[11px] text-muted-foreground font-mono">Aguardando primeira tentativa…</p>
          </div>
        ) : (
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
                    o.kind === 'connecting' && 'border-amber-500/40',
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {o.kind === 'ok' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    {o.kind === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
                    {o.kind === 'connecting' && <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-mono font-semibold truncate">M1 · addr {a.masterAddress}</p>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">{ts}</span>
                    </div>
                    {o.kind === 'ok' && (
                      <>
                        <p className="text-[11px] text-emerald-300 font-mono">
                          OK — {o.latencyMs}ms · FW {o.firmware} · {o.slavesOnline} slave(s)
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
                      <p className="text-[11px] text-amber-300 font-mono">Abrindo porta + STATUS…</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-12 gap-2"
          onClick={onChangeAddress}
          disabled={isHandshaking}
        >
          <ArrowLeft className="w-4 h-4" /> Trocar addr
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
