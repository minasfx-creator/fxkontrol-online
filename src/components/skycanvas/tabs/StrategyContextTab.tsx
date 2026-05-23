/**
 * Strategy Context Tab — read-only lens into Strategic Hub's active session.
 * Pure observer; never writes session state.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Compass } from 'lucide-react';
import { useActiveDemoSession } from '@/hooks/useActiveDemoSession';
import { ClaimBadge } from '@/components/strategy/ClaimBadge';

export default function StrategyContextTab() {
  const session = useActiveDemoSession();
  const navigate = useNavigate();

  return (
    <div className="space-y-3 p-2">
      <header className="flex items-center justify-between">
        <h3 className="ds-mono text-[11px] uppercase tracking-wider text-cyan-300/90">
          Sessão estratégica
        </h3>
        <button
          type="button"
          onClick={() => navigate('/strategy')}
          className="glass-chip ds-focus inline-flex items-center gap-1 px-2.5 py-1 text-[10px] ds-mono uppercase tracking-wider text-cyan-200 hover:text-cyan-100"
        >
          <Compass className="h-3 w-3" /> /strategy <ArrowUpRight className="h-3 w-3" />
        </button>
      </header>

      <div className="glass-section-divider" />

      {!session ? (
        <div className="rounded-lg border border-dashed border-white/[0.08] p-4 text-center">
          <Compass className="h-5 w-5 mx-auto text-zinc-600 mb-2" />
          <p className="ds-mono text-[10px] text-zinc-500 uppercase tracking-wider">
            Nenhuma sessão ativa
          </p>
          <button
            type="button"
            onClick={() => navigate('/strategy')}
            className="mt-2 text-[10px] text-cyan-300 hover:text-cyan-200 underline"
          >
            Abrir Strategic Hub →
          </button>
        </div>
      ) : (
        <div className="glass-chip rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="ds-mono text-[9px] text-zinc-500 uppercase">Cliente</span>
            <span className="text-[12px] text-zinc-200 truncate">
              {session.clientName ?? '—'}
            </span>
            {session.claim && <ClaimBadge status={session.claim} className="ml-auto" />}
          </div>
          <div className="text-[10px] text-zinc-500 ds-mono">
            session: {session.id.slice(0, 8)}…
          </div>
        </div>
      )}

      <p className="text-[10px] text-zinc-500 leading-relaxed">
        Os dados desta sessão alimentam relatórios de aprovação, exports honestos
        e claim policies. Edição completa em /strategy.
      </p>
    </div>
  );
}
