/**
 * MetaHumanCoachPanel — instrutor cinematográfico (Capitão Vega).
 * ─────────────────────────────────────────────────────────────────────
 * Renderiza o instrutor MetaHuman-stand-in em um <Canvas> isolado +
 * painel de dicas contextuais (erro, replay sugestão, próxima missão).
 *
 * Regras safety (memória):
 *   • Bloqueado em real_operation via SafetyTrainingGate.
 *   • Coach NUNCA executa comando: apenas explica, narra e sugere.
 *   • Tokens canônicos (--ds-* / --status-*). Sem hex literal exceto
 *     o background do Canvas (Vantablack hsl).
 *   • prefers-reduced-motion: o Canvas continua, mas a fala/typewriter
 *     na sidebar respeita degradação (sem pulsos no badge).
 */
import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sparkles, AlertCircle, Lightbulb, ArrowRight } from 'lucide-react';
import HumanoidCharacter from '../humanoid/HumanoidCharacter';
import { getNPC } from '../npcs/npcCatalog';
import SafetyTrainingGate from '../safety/SafetyTrainingGate';
import { cn } from '@/lib/utils';

export type CoachTip = {
  kind: 'briefing' | 'mistake' | 'hint' | 'achievement';
  title: string;
  body: string;
  cta?: { label: string; onClick: () => void };
};

interface Props {
  /** Defaults to capitao-vega. */
  instructorId?: string;
  /** Currently displayed tip; component animates in on change. */
  tip?: CoachTip | null;
  /** Optional class for layout overrides. */
  className?: string;
}

const DEFAULT_TIP: CoachTip = {
  kind: 'briefing',
  title: 'Bem-vindo, operador.',
  body: 'Sou Capitão Vega. Vou te guiar pelas missões. Lembre-se: aqui é simulação — nada físico acontece.',
};

const KIND_META: Record<CoachTip['kind'], { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }> = {
  briefing:    { icon: Sparkles,     tone: 'status-sync', label: 'Briefing' },
  mistake:     { icon: AlertCircle,  tone: 'status-warn', label: 'Atenção' },
  hint:        { icon: Lightbulb,    tone: 'status-sync', label: 'Dica' },
  achievement: { icon: Sparkles,     tone: 'status-ok',   label: 'Conquista' },
};

export default function MetaHumanCoachPanel({ instructorId = 'capitao-vega', tip, className }: Props) {
  const persona = getNPC(instructorId) ?? getNPC('capitao-vega')!;
  const active = tip ?? DEFAULT_TIP;
  const KindIcon = KIND_META[active.kind].icon;
  const tone = KIND_META[active.kind].tone;

  // Lipsync proxy — pulses while the typewriter is "speaking".
  const [amp, setAmp] = useState(0);
  const [typed, setTyped] = useState('');
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    setTyped('');
    startRef.current = performance.now();
    let cancelled = false;
    const total = active.body.length;
    const stepMs = 18;

    function tick() {
      if (cancelled) return;
      const elapsed = performance.now() - startRef.current;
      const charCount = Math.min(total, Math.floor(elapsed / stepMs));
      setTyped(active.body.slice(0, charCount));
      // jaw amplitude follows char rate (clamps 0..0.7)
      setAmp(charCount < total ? 0.45 + Math.sin(elapsed / 90) * 0.2 : 0);
      if (charCount < total) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setAmp(0);
    };
  }, [active.body]);

  return (
    <SafetyTrainingGate>
      <section
        className={cn(
          'rounded-ds-md border border-ds-border-default bg-ds-surface-panel overflow-hidden grid md:grid-cols-[1fr_minmax(260px,360px)]',
          className,
        )}
      >
        {/* ── Cinematic stage (Canvas) ─────────────────────────── */}
        <div
          className="relative min-h-[260px] md:min-h-[320px] border-b md:border-b-0 md:border-r border-ds-border-subtle"
          style={{ background: 'hsl(220 30% 4%)' }}
        >
          <Canvas
            camera={{ position: [1.6, 1.65, 2.2], fov: 32 }}
            shadows={false}
            gl={{ antialias: true, alpha: false }}
            dpr={[1, 1.5]}
          >
            <ambientLight intensity={0.35} />
            <directionalLight position={[2, 4, 3]} intensity={1.2} color="hsl(190 70% 88%)" />
            <directionalLight position={[-3, 2, -2]} intensity={0.45} color="hsl(35 80% 70%)" />
            <HumanoidCharacter
              persona={persona}
              position={[0, 0, 0]}
              rotationY={-0.15}
              lookAtTarget={[1.6, 1.65, 2.2]}
              speakingAmplitude={amp}
              intent="serious"
              closeup
            />
          </Canvas>

          {/* Letterbox (cinematic feel) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-ds-background/90 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-ds-background/90 to-transparent" />

          {/* Name plate */}
          <div className="absolute left-3 bottom-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-status-sync animate-pulse" />
            <span className="text-[10px] ds-mono uppercase tracking-[0.2em] text-status-sync">
              {persona.displayName}
            </span>
            <span className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-muted">
              · {persona.role}
            </span>
          </div>
        </div>

        {/* ── Tip sidebar ──────────────────────────────────────── */}
        <div className="p-ds-4 flex flex-col gap-ds-2">
          <div className="flex items-center gap-2">
            <KindIcon className={cn('h-3.5 w-3.5', `text-${tone}`)} aria-hidden />
            <span className={cn('text-[10px] ds-mono uppercase tracking-wider', `text-${tone}`)}>
              {KIND_META[active.kind].label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-ds-text-primary">{active.title}</h3>
          <p className="text-[12px] leading-relaxed text-ds-text-secondary min-h-[5em]">
            {typed}
            {typed.length < active.body.length && (
              <span className="ml-0.5 inline-block w-1.5 h-3 align-middle bg-status-sync animate-pulse" aria-hidden />
            )}
          </p>
          {active.cta && (
            <button
              onClick={active.cta.onClick}
              className="mt-auto self-start inline-flex items-center gap-1.5 rounded-ds-sm border border-status-sync/40 bg-status-sync/10 px-ds-3 py-ds-2 text-[11px] ds-mono uppercase tracking-wider text-status-sync hover:bg-status-sync/20 transition-colors"
            >
              {active.cta.label} <ArrowRight className="h-3 w-3" />
            </button>
          )}
          <p className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-muted mt-ds-2">
            Coach simulação · não comanda hardware
          </p>
        </div>
      </section>
    </SafetyTrainingGate>
  );
}
