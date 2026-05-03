/**
 * TrainingCenter — GTA V Pause Menu shell para o módulo Training.
 * ─────────────────────────────────────────────────────────────────────
 * Tabs MAPA · MISSÕES · OPERADOR · PROGRESSO · SETTINGS, com transições
 * fade+blur. Tokens canônicos APENAS:
 *   • Vantablack stack (--ds-background / --ds-surface-*)
 *   • Cyan-dessat (--field-cyan / --status-sync) para hover/active
 *   • Status (--status-ok/warn/fail) para verdict
 *   • Microinterações via .op-* (já implementadas no index.css)
 *
 * Regras críticas (memória):
 *   • Em real_operation o shell GTA é OCULTADO (banner industrial clean).
 *     Só Training/Simulation podem usar HUD lúdico — nunca produção.
 *   • Não dispara, não arma, não muta workMode. Reusa MissionRunner via
 *     CinematicTrainingSimulator quando o usuário inicia uma missão.
 *   • Sem Radix Collapsible nesting de buttons — usa <button> direto.
 *   • Acessibilidade: tabs role=tablist + aria-selected; respeita
 *     prefers-reduced-motion (animações degradam para opacity-only).
 */
import { useEffect, useRef, useState } from 'react';
import { Map as MapIcon, Target, User, Trophy, Settings, Lock, Star, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkMode } from '@/core/safety/workMode';
import { MISSION_SCRIPTS } from '@/components/training/missions/missionScripts';
import type { MissionScript } from '@/components/training/missions/types';
import MetaHumanCoachPanel, { type CoachTip } from '@/components/training/coach/MetaHumanCoachPanel';
import MissionBriefingMetaHuman from '@/components/training/briefing/MissionBriefingMetaHuman';
import { isEnabled } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';

type TabId = 'map' | 'missions' | 'operator' | 'progress' | 'settings';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'map', label: 'MAPA', icon: MapIcon },
  { id: 'missions', label: 'MISSÕES', icon: Target },
  { id: 'operator', label: 'OPERADOR', icon: User },
  { id: 'progress', label: 'PROGRESSO', icon: Trophy },
  { id: 'settings', label: 'SETTINGS', icon: Settings },
];

const DIFF_STARS: Record<string, number> = { easy: 1, medium: 2, hard: 3, legendary: 4 };

export default function TrainingCenter() {
  const mode = useWorkMode();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('missions');
  // Transition fade key — increments per tab change to replay enter animation.
  const transKeyRef = useRef(0);
  transKeyRef.current += 1;

  useEffect(() => {
    const prev = document.title;
    document.title = 'Training Center — FXKONTROL';
    return () => { document.title = prev; };
  }, []);

  // ── Real-operation guard: hide GTA shell in production. ───────────
  if (mode === 'real_operation') {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-ds-background p-ds-6">
        <div className="max-w-md text-center space-y-ds-3 rounded-ds-md border border-status-warn/40 bg-ds-surface-panel p-ds-6">
          <Lock className="h-8 w-8 mx-auto text-status-warn" />
          <h1 className="text-ds-h2 text-ds-text-primary">Training Center indisponível</h1>
          <p className="text-sm text-ds-text-secondary">
            O HUD de treinamento estilo cinemático é restrito a <strong>design</strong> e{' '}
            <strong>simulation</strong>. O modo atual é <span className="ds-mono uppercase text-status-warn">real_operation</span>.
            Use o console industrial para operações em campo.
          </p>
          <button
            onClick={() => navigate('/command')}
            className="inline-flex items-center gap-ds-2 rounded-ds-sm border border-ds-border-active/60 bg-ds-surface-elevated px-ds-3 py-ds-2 text-xs ds-mono uppercase tracking-wider text-status-sync hover:bg-status-sync/10 transition-colors"
          >
            Abrir Command Center <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-ds-background text-ds-text-primary flex flex-col">
      {/* ── Header (GTA pause-menu chrome) ─────────────────────────── */}
      <header
        className="sticky top-0 z-20 border-b border-ds-border-default bg-ds-surface-deep/90"
        style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      >
        <div className="px-ds-4 py-ds-3 flex items-center justify-between gap-ds-3 flex-wrap">
          <div className="flex items-center gap-ds-3">
            <span className="text-[10px] ds-mono uppercase tracking-[0.3em] text-ds-text-muted">FX KONTROL</span>
            <span className="h-4 w-px bg-ds-border-default" />
            <h1 className="text-sm font-semibold tracking-wider uppercase">Training Center</h1>
          </div>
          <div className="flex items-center gap-ds-3 text-[10px] ds-mono uppercase tracking-wider">
            <span className="text-ds-text-secondary">WorkMode</span>
            <span className={cn(
              'px-2 py-0.5 rounded-ds-sm border',
              mode === 'simulation'
                ? 'border-status-sync/40 bg-status-sync/10 text-status-sync'
                : 'border-status-ok/40 bg-status-ok/10 text-status-ok',
            )}>
              {mode}
            </span>
            <span className="text-ds-text-muted">·</span>
            <span className="text-ds-text-secondary">Safety</span>
            <span className="inline-flex items-center gap-1.5 text-status-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-status-ok" /> OK
            </span>
          </div>
        </div>

        {/* Tab strip ─ GTA highlight (cyan underline + glow) */}
        <nav role="tablist" className="px-ds-2 flex items-center gap-ds-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative inline-flex items-center gap-1.5 px-ds-3 py-ds-2 text-[11px] ds-mono uppercase tracking-wider whitespace-nowrap transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-field-cyan/45',
                  active
                    ? 'text-status-sync'
                    : 'text-ds-text-secondary hover:text-ds-text-primary',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {active && (
                  <span
                    className="absolute left-2 right-2 -bottom-px h-0.5 bg-status-sync"
                    style={{ boxShadow: '0 0 12px hsl(var(--status-sync) / 0.55)' }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Body (animated per tab) ────────────────────────────────── */}
      <main
        key={transKeyRef.current}
        className="flex-1 px-ds-4 py-ds-4 animate-fade-in"
      >
        {tab === 'map' && <MapPanel />}
        {tab === 'missions' && <MissionsPanel />}
        {tab === 'operator' && <OperatorPanel />}
        {tab === 'progress' && <ProgressPanel />}
        {tab === 'settings' && <SettingsPanel mode={mode} />}
      </main>

      {/* ── Bottom HUD strip (GTA mini-map / status / inputs) ──────── */}
      <footer className="border-t border-ds-border-default bg-ds-surface-deep/85"
        style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      >
        <div className="grid grid-cols-3 gap-ds-2 px-ds-4 py-ds-2 text-[10px] ds-mono uppercase tracking-wider">
          <div className="text-ds-text-muted">
            MINI-MAP <span className="text-ds-text-secondary">arena view</span>
          </div>
          <div className="text-center text-ds-text-secondary">
            STATUS <span className="text-status-sync">{mode}</span>
          </div>
          <div className="text-right text-ds-text-muted">
            INPUTS <span className="text-ds-text-secondary">⌨️ + 🖱</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tab panels
// ─────────────────────────────────────────────────────────────────────

function MapPanel() {
  return (
    <div className="space-y-ds-3">
      <div className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel min-h-[420px] grid place-items-center text-ds-text-muted">
        <div className="text-center space-y-ds-2">
          <MapIcon className="h-10 w-10 mx-auto text-status-sync/70" />
          <p className="text-xs ds-mono uppercase tracking-wider">3D Arena · Free Roam</p>
          <p className="text-[11px] text-ds-text-secondary max-w-md">
            WASD para navegar · Click em props para inspecionar · Scroll para zoom.
            Stub visual — reusará Show3DEngine quando integrado.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-ds-2">
        {['Maracanã', 'Galpão Ensaio', 'Show Space'].map((v) => (
          <div key={v} className="rounded-ds-sm border border-ds-border-default bg-ds-surface-panel p-ds-3 hover:bg-ds-surface-elevated transition-colors cursor-pointer">
            <p className="text-xs font-semibold text-ds-text-primary">{v}</p>
            <p className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-muted mt-1">free roam</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissionsPanel() {
  const navigate = useNavigate();
  const v2 = isEnabled('training_v2_cinematic');

  return (
    <div className="space-y-ds-3">
      <div className="flex items-center justify-between">
        <h2 className="text-ds-h3 text-ds-text-primary">Missões</h2>
        <span className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-muted">
          scroll horizontal · {MISSION_SCRIPTS.length} cenários
        </span>
      </div>
      <div
        className="flex gap-ds-3 overflow-x-auto pb-ds-2"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {MISSION_SCRIPTS.map((m) => {
          const stars = DIFF_STARS[m.difficulty as string] ?? 1;
          return (
            <article
              key={m.id}
              style={{ scrollSnapAlign: 'start', minWidth: 320 }}
              className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-ds-3 hover:bg-ds-surface-elevated hover:border-ds-border-active/60 transition-all"
            >
              <div className="aspect-video rounded-ds-sm bg-ds-surface-deep border border-ds-border-subtle mb-ds-2 grid place-items-center">
                <Target className="h-8 w-8 text-status-sync/70" />
              </div>
              <h3 className="text-sm font-semibold text-ds-text-primary">{m.title}</h3>
              <div className="mt-1 flex items-center gap-1.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn('h-3 w-3', i < stars ? 'text-status-warn fill-status-warn/40' : 'text-ds-text-disabled')}
                  />
                ))}
                <span className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-muted ml-1">
                  {m.difficulty}
                </span>
              </div>
              <p className="text-[11px] text-ds-text-secondary mt-2 line-clamp-2">
                {m.scenario ?? '—'}
              </p>
              <button
                disabled={!v2}
                onClick={() => navigate('/training', { state: { missionId: m.id } })}
                className={cn(
                  'mt-ds-3 w-full inline-flex items-center justify-center gap-1.5 rounded-ds-sm px-ds-3 py-ds-2 text-[11px] ds-mono uppercase tracking-wider transition-colors',
                  v2
                    ? 'bg-status-sync/10 border border-status-sync/40 text-status-sync hover:bg-status-sync/20'
                    : 'bg-ds-surface-deep border border-ds-border-subtle text-ds-text-disabled cursor-not-allowed',
                )}
              >
                {v2 ? <>Iniciar Missão <ArrowRight className="h-3 w-3" /></> : <>Indisponível</>}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function OperatorPanel() {
  const skills = [
    { label: 'Safety',   value: 100, color: 'status-ok' as const },
    { label: 'Timing',   value: 80,  color: 'status-sync' as const },
    { label: 'Hardware', value: 60,  color: 'status-warn' as const },
  ];
  return (
    <div className="grid md:grid-cols-2 gap-ds-3">
      <div className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-ds-4 space-y-ds-2">
        <p className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-muted">Operador</p>
        <h3 className="text-ds-h3 text-ds-text-primary">Marco Santos</h3>
        <p className="text-[11px] ds-mono uppercase tracking-wider text-status-sync">Elite Operator</p>
        <p className="text-xs text-ds-text-secondary mt-ds-2">Devices conectados: <span className="text-ds-text-primary">0</span></p>
      </div>
      <div className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-ds-4 space-y-ds-3">
        <p className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-muted">Skills</p>
        {skills.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between text-[11px] ds-mono uppercase tracking-wider">
              <span className="text-ds-text-secondary">{s.label}</span>
              <span className={`text-${s.color}`}>{s.value}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-ds-surface-deep overflow-hidden">
              <div
                className={`h-full bg-${s.color}`}
                style={{ width: `${s.value}%`, transition: 'width 400ms cubic-bezier(0.16,1,0.3,1)' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressPanel() {
  return (
    <div className="space-y-ds-3">
      <div className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-ds-4">
        <p className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-muted">Capítulo 3 · Stadium Ops</p>
        <div className="mt-ds-2 h-2 rounded-full bg-ds-surface-deep overflow-hidden">
          <div className="h-full bg-status-sync" style={{ width: '75%' }} />
        </div>
        <p className="text-[11px] ds-mono uppercase tracking-wider text-status-sync mt-1">75%</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-ds-2">
        {[
          { t: 'Zero Safety Violations', s: 'status-ok' as const },
          { t: 'Perfect Timing <20ms',   s: 'status-sync' as const },
          { t: 'Hardware Master',         s: 'status-warn' as const },
        ].map((a) => (
          <div key={a.t} className="rounded-ds-sm border border-ds-border-default bg-ds-surface-panel p-ds-3">
            <Trophy className={`h-4 w-4 text-${a.s}`} />
            <p className="text-xs font-semibold text-ds-text-primary mt-1">{a.t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({ mode }: { mode: 'design' | 'simulation' | 'real_operation' }) {
  return (
    <div className="space-y-ds-3 max-w-xl">
      <div className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-ds-4">
        <p className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-muted">WorkMode atual</p>
        <p className="text-sm font-semibold text-ds-text-primary mt-1">{mode}</p>
        <p className="text-[11px] text-ds-text-secondary mt-2">
          Para alternar para <span className="ds-mono uppercase">real_operation</span> use o painel Phase 2 em
          <span className="ds-mono"> /dev/golden-shows</span> (Hold-1.2s, exige grant fresco ≤5min).
          O Training Center NÃO muta workMode.
        </p>
      </div>
      <div className="rounded-ds-md border border-status-warn/40 bg-ds-surface-panel p-ds-4">
        <p className="text-[10px] ds-mono uppercase tracking-wider text-status-warn">Real Operation</p>
        <p className="text-sm font-semibold text-ds-text-primary mt-1 inline-flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> LOCKED
        </p>
        <p className="text-[11px] text-ds-text-secondary mt-2">Grant necessário (≤5min) — Hold-to-Confirm + dual sign-off.</p>
      </div>
    </div>
  );
}
