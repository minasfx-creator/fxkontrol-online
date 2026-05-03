/**
 * SafetyTrainingGate — bloqueia QUALQUER UI lúdica em real_operation.
 * ─────────────────────────────────────────────────────────────────────
 * Regra (memória canônica):
 *   • design / simulation  → permitido (treinamento, NPCs, MetaHuman, briefing cinematográfico)
 *   • real_operation       → BLOQUEIA: sem cutscene, sem gamificação, sem NPC,
 *                            sem botão cinematográfico. Apenas fallback industrial.
 *
 * Não muta workMode. Não chama CommandBus. Pura presentation.
 */
import { Lock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkMode } from '@/core/safety/workMode';

export function useTrainingAllowed(): boolean {
  const mode = useWorkMode();
  return mode === 'design' || mode === 'simulation';
}

export default function SafetyTrainingGate({ children }: { children: React.ReactNode }) {
  const mode = useWorkMode();
  const navigate = useNavigate();
  if (mode !== 'real_operation') return <>{children}</>;

  return (
    <div className="min-h-[60vh] grid place-items-center p-ds-6">
      <div className="max-w-md text-center space-y-ds-3 rounded-ds-md border border-status-warn/40 bg-ds-surface-panel p-ds-6">
        <Lock className="h-8 w-8 mx-auto text-status-warn" aria-hidden />
        <h2 className="text-ds-h3 text-ds-text-primary">Conteúdo de treinamento bloqueado</h2>
        <p className="text-ds-label text-ds-text-secondary">
          Cutscene, MetaHuman e gamificação são restritos a <strong>design</strong> e{' '}
          <strong>simulation</strong>. WorkMode atual:{' '}
          <span className="ds-mono uppercase text-status-warn">real_operation</span>.
        </p>
        <button
          onClick={() => navigate('/command')}
          className="inline-flex items-center gap-ds-2 rounded-ds-sm border border-ds-border-active/60 bg-ds-surface-elevated px-ds-3 py-ds-2 text-ds-caption ds-mono uppercase tracking-wider text-status-sync hover:bg-status-sync/10 transition-colors"
        >
          Abrir Command Center <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
