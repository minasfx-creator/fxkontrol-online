/**
 * MissionBriefingMetaHuman — modal de briefing cinematográfico.
 * ─────────────────────────────────────────────────────────────────────
 * Mostra Capitão Vega + sinopse + objetivos antes da missão. Click em
 * "Iniciar Missão" emite onStart. ESC ou click no backdrop cancela.
 * Restrito a design/simulation (gate aplicado pelo container).
 */
import { useEffect } from 'react';
import { X, Play, Target } from 'lucide-react';
import MetaHumanCoachPanel, { type CoachTip } from '../coach/MetaHumanCoachPanel';
import type { MissionScript } from '../missions/types';

interface Props {
  mission: MissionScript;
  onStart: () => void;
  onClose: () => void;
}

export default function MissionBriefingMetaHuman({ mission, onStart, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tip: CoachTip = {
    kind: 'briefing',
    title: mission.title,
    body: mission.scenario ?? mission.synopsis ?? 'Operador, valide todos os gates antes de armar.',
    cta: { label: 'Iniciar Missão', onClick: onStart },
  };

  // Stage 1 objectives preview (any stage with objectives)
  const objectives = (mission.stages ?? [])
    .flatMap((s) => ('objectives' in s && Array.isArray((s as { objectives?: unknown[] }).objectives)
      ? (s as { objectives: { label?: string }[] }).objectives
      : []))
    .slice(0, 6);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Briefing — ${mission.title}`}
      className="fixed inset-0 z-[80] grid place-items-center p-ds-4 bg-ds-background/85"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-ds-md border border-ds-border-default bg-ds-surface-deep shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-ds-4 py-ds-3 border-b border-ds-border-default">
          <div className="flex items-center gap-2">
            <span className="text-[10px] ds-mono uppercase tracking-[0.3em] text-ds-text-muted">
              {mission.chapter ?? 'Mission Briefing'}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar briefing"
            className="text-ds-text-muted hover:text-ds-text-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-ds-4 space-y-ds-3">
          <MetaHumanCoachPanel tip={tip} />

          {objectives.length > 0 && (
            <div className="rounded-ds-sm border border-ds-border-subtle bg-ds-surface-panel p-ds-3">
              <div className="flex items-center gap-2 mb-ds-2">
                <Target className="h-3.5 w-3.5 text-status-sync" />
                <span className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-muted">
                  Objetivos preview
                </span>
              </div>
              <ul className="grid sm:grid-cols-2 gap-1.5 text-[11px] text-ds-text-secondary">
                {objectives.map((o, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-ds-text-disabled">○</span>
                    {o.label ?? `Objetivo ${i + 1}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-ds-2 pt-ds-1">
            <button
              onClick={onClose}
              className="rounded-ds-sm border border-ds-border-default px-ds-3 py-ds-2 text-[11px] ds-mono uppercase tracking-wider text-ds-text-secondary hover:text-ds-text-primary hover:bg-ds-surface-panel transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onStart}
              className="inline-flex items-center gap-1.5 rounded-ds-sm border border-status-sync/40 bg-status-sync/10 px-ds-4 py-ds-2 text-[11px] ds-mono uppercase tracking-wider text-status-sync hover:bg-status-sync/20 transition-colors op-go-pulse"
            >
              <Play className="h-3.5 w-3.5" /> Iniciar Missão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
