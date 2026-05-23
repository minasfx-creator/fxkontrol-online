/**
 * Training v2.1 — Achievements badge strip (presentational only).
 *
 * Renders the awarded achievements for a debrief, highlighting newly-earned
 * ones with the canonical .op-go-pulse micro-interaction (status tokens only).
 */
import { Award, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ACHIEVEMENT_CATALOG,
  type AchievementId,
} from './achievements';

const TONE_CLASS: Record<string, { ring: string; text: string; bg: string }> = {
  ok:   { ring: 'border-status-ok/45',   text: 'text-status-ok',   bg: 'bg-status-ok/10' },
  sync: { ring: 'border-status-sync/45', text: 'text-status-sync', bg: 'bg-status-sync/10' },
  warn: { ring: 'border-status-warn/45', text: 'text-status-warn', bg: 'bg-status-warn/10' },
  fail: { ring: 'border-status-fail/45', text: 'text-status-fail', bg: 'bg-status-fail/10' },
};

interface Props {
  awarded: ReadonlyArray<AchievementId>;
  newlyAwarded?: ReadonlyArray<AchievementId>;
  newlyUnlockedMissions?: ReadonlyArray<string>;
}

export default function AchievementsBadgeStrip({
  awarded,
  newlyAwarded = [],
  newlyUnlockedMissions = [],
}: Props) {
  const all = (Object.keys(ACHIEVEMENT_CATALOG) as AchievementId[]);

  return (
    <div className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-ds-4 space-y-ds-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Award className="h-4 w-4 text-status-warn" />
          <p className="text-[10px] uppercase tracking-[0.25em] ds-mono text-ds-text-muted">
            Conquistas
          </p>
        </div>
        <p className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-muted">
          {awarded.length}/{all.length}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-ds-2">
        {all.map((id) => {
          const def = ACHIEVEMENT_CATALOG[id];
          const earned = awarded.includes(id);
          const isNew = newlyAwarded.includes(id);
          const tone = TONE_CLASS[def.tone] ?? TONE_CLASS.sync;
          return (
            <div
              key={id}
              data-testid={`achievement-${id}`}
              data-earned={earned ? 'true' : 'false'}
              data-new={isNew ? 'true' : 'false'}
              className={cn(
                'rounded-ds-sm border p-ds-3 transition-colors',
                earned ? cn(tone.ring, tone.bg) : 'border-ds-border-subtle bg-ds-surface-deep/50',
                isNew && 'op-go-pulse',
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <p className={cn(
                  'text-xs font-semibold',
                  earned ? tone.text : 'text-ds-text-disabled',
                )}>
                  {def.label}
                </p>
                {earned ? (
                  <Sparkles className={cn('h-3 w-3', tone.text)} />
                ) : (
                  <Lock className="h-3 w-3 text-ds-text-disabled" />
                )}
              </div>
              <p className="text-[10px] text-ds-text-secondary leading-snug">
                {def.description}
              </p>
              <p className="text-[9px] ds-mono uppercase tracking-wider text-ds-text-muted mt-1">
                +{def.xpBonus} XP
              </p>
            </div>
          );
        })}
      </div>

      {newlyUnlockedMissions.length > 0 && (
        <div
          data-testid="newly-unlocked-missions"
          className="rounded-ds-sm border border-status-sync/45 bg-status-sync/10 p-ds-2 op-go-pulse"
        >
          <p className="text-[10px] ds-mono uppercase tracking-wider text-status-sync">
            Missões desbloqueadas
          </p>
          <ul className="mt-1 space-y-0.5">
            {newlyUnlockedMissions.map((id) => (
              <li key={id} className="text-xs text-ds-text-primary ds-mono">
                ▸ {id}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
