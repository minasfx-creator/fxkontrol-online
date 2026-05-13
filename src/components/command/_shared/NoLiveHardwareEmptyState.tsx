/**
 * ─── NoLiveHardwareEmptyState ────────────────────────────────────
 * Estado vazio canônico p/ painéis de comando que dependem de telemetria
 * de hardware. Usa `useConsoleProvenance` p/ resolver o modo (simulated
 * vs live_read_only) e renderiza um bloco honesto + CTA p/ pareamento.
 *
 * Honest-Hardware Layer compatible: NUNCA renderiza dados sintéticos
 * por baixo. Quando `mode !== 'live_read_only'`, o painel pai deve
 * delegar TODA a UI ao empty state (não renderizar valores falsos ao
 * lado).
 */
import { Link } from 'react-router-dom';
import { Cpu, ChevronRight } from 'lucide-react';
import { ProvenanceBadge } from '@/components/safety/ProvenanceBadge';
import { useConsoleProvenance } from '@/hooks/useConsoleProvenance';
import type { ControllerKind } from '@/core/discovery/controllerRegistry';

export interface NoLiveHardwareEmptyStateProps {
  /** Famílias de controlador esperadas pelo painel pai. */
  kinds: ControllerKind[];
  /** Label do painel (ex.: "FXK-DRONE", "FXK-NET"). */
  label: string;
  /** Mensagem específica do painel — opcional. */
  message?: string;
  /** Rota de pareamento sugerida. */
  pairingHref?: string;
  className?: string;
}

export default function NoLiveHardwareEmptyState({
  kinds,
  label,
  message,
  pairingHref = '/pairing',
  className,
}: NoLiveHardwareEmptyStateProps) {
  const mode = useConsoleProvenance(kinds);
  const live = mode === 'live_read_only';
  const detail = message ??
    `Sem link verificado com ${kinds.join(' / ')}. Telemetria desabilitada (Honest Hardware).`;

  return (
    <div
      role="status"
      aria-live="polite"
      data-empty="no-live-hardware"
      className={[
        'flex-1 min-h-0 w-full flex items-center justify-center p-8',
        className ?? '',
      ].join(' ')}
      style={{ background: 'hsl(220 12% 4%)' }}
    >
      <div className="max-w-md w-full flex flex-col items-center gap-4 text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center border"
          style={{
            background: 'hsl(220 12% 6%)',
            borderColor: 'hsl(0 85% 48% / 0.25)',
          }}
        >
          <Cpu className="w-6 h-6" style={{ color: 'hsl(0 85% 55%)' }} />
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-muted-foreground/60">
            {label}
          </span>
          <ProvenanceBadge mode={live ? 'live_read_only' : 'not_integrated'} compact />
        </div>

        <p className="text-xs text-muted-foreground/70 leading-relaxed font-mono">
          {detail}
        </p>

        {!live && (
          <Link
            to={pairingHref}
            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-[11px] font-mono uppercase tracking-wider transition-colors hover:bg-foreground/5"
            style={{
              borderColor: 'hsl(190 70% 58% / 0.4)',
              color: 'hsl(190 70% 70%)',
            }}
          >
            Abrir Pareamento
            <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
