/**
 * OfficeKpiHero — Welcome hero with live KPIs above the hub cards.
 *
 * Honest data sources:
 *   • Shows         → count(projects) for the signed-in user (Supabase).
 *   • Missões done  → completed missions persisted in localStorage
 *                     under fxk.training.completedMissions.v1 (Set<id>).
 *   • Devices online→ deviceAggregator.list() filtered by `online`.
 *   • Última op.    → workMode label.
 *
 * Presentation only. Never queries hardware directly, never arms anything.
 */
import { useEffect, useMemo, useState } from 'react';
import { Activity, GraduationCap, Cable, FolderOpen } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { deviceAggregator } from '@/core/discovery/DeviceAggregator';
import { workMode } from '@/core/safety/workMode';
import { MISSION_SCRIPTS } from '@/components/training/missions/missionScripts';

const COMPLETED_KEY = 'fxk.training.completedMissions.v1';

function readCompletedMissionIds(): string[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(COMPLETED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

interface KpiTile {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  tone?: 'sync' | 'ok' | 'warn';
}

export default function OfficeKpiHero() {
  const { user } = useAuth();
  const [shows, setShows] = useState<number | null>(null);
  const [completedCount, setCompletedCount] = useState<number>(() => readCompletedMissionIds().length);
  const [devicesOnline, setDevicesOnline] = useState<number>(0);
  const [mode, setMode] = useState(workMode.get());

  // ── Shows count (Supabase) ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setShows(0);
      return;
    }
    (async () => {
      const { count, error } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (!cancelled) setShows(error ? 0 : count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Devices online (live) ───────────────────────────────────────────
  useEffect(() => {
    const recompute = () => {
      try {
        const list = deviceAggregator.list?.() ?? [];
        setDevicesOnline(list.filter((d: any) => d?.online).length);
      } catch {
        setDevicesOnline(0);
      }
    };
    recompute();
    const unsub = deviceAggregator.watch?.(recompute);
    return () => {
      try { unsub?.(); } catch { /* noop */ }
    };
  }, []);

  // ── Mission progress (storage event) ────────────────────────────────
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === COMPLETED_KEY) setCompletedCount(readCompletedMissionIds().length);
    };
    window.addEventListener('storage', onStorage);
    const id = window.setInterval(() => {
      const next = readCompletedMissionIds().length;
      setCompletedCount((prev) => (prev === next ? prev : next));
    }, 4000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(id);
    };
  }, []);

  // ── Work mode ───────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = workMode.subscribe?.(setMode);
    return () => { try { unsub?.(); } catch { /* noop */ } };
  }, []);

  const tiles: KpiTile[] = useMemo(() => {
    const totalMissions = MISSION_SCRIPTS.length;
    const modeLabel =
      mode === 'real_operation' ? 'Real Operation'
        : mode === 'simulation' ? 'Simulação'
        : 'Design';
    return [
      {
        icon: FolderOpen,
        label: 'Shows',
        value: shows == null ? '…' : String(shows),
        hint: shows && shows > 0 ? 'Abra um projeto recente' : 'Crie seu primeiro show',
        tone: 'sync',
      },
      {
        icon: GraduationCap,
        label: 'Missões completas',
        value: `${completedCount}/${totalMissions}`,
        hint: completedCount === 0 ? 'Comece pela Cap. 1' : 'Catálogo cinematográfico',
        tone: completedCount > 0 ? 'ok' : 'sync',
      },
      {
        icon: Cable,
        label: 'Devices online',
        value: String(devicesOnline),
        hint: devicesOnline === 0 ? 'Pareie via USB / BLE' : 'Multi-transport ativo',
        tone: devicesOnline > 0 ? 'ok' : 'sync',
      },
      {
        icon: Activity,
        label: 'Modo atual',
        value: modeLabel,
        hint: mode === 'real_operation' ? 'Intertravamentos físicos ON' : 'Sem bloqueios',
        tone: mode === 'real_operation' ? 'warn' : 'sync',
      },
    ];
  }, [shows, completedCount, devicesOnline, mode]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return 'Boa madrugada';
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const displayName =
    (user?.user_metadata as any)?.full_name || user?.email?.split('@')[0] || 'Operador';

  return (
    <section className="relative overflow-hidden bg-ds-background border-b border-ds-border-subtle px-ds-4 sm:px-ds-6 pt-ds-6 pb-ds-4">
      {/* subtle cyan glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: 'radial-gradient(circle, hsl(190 70% 58%) 0%, transparent 70%)' }}
      />
      <div className="relative mx-auto max-w-6xl space-y-ds-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="ds-mono text-[10px] tracking-[0.2em] uppercase text-status-sync/70">
              FX KONTROL · OFFICE
            </p>
            <h1 className="mt-1 text-[22px] sm:text-[28px] font-semibold text-ds-text-primary">
              {greeting}, <span className="text-status-sync">{displayName}</span>.
            </h1>
            <p className="mt-1 ds-caption">
              Visão geral em tempo real do seu universo operacional.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-ds-md border border-ds-border-subtle bg-ds-surface-elevated/60 px-3 py-1.5">
            <span className={`size-1.5 rounded-full ${mode === 'real_operation' ? 'bg-status-warn animate-pulse' : 'bg-status-ok'}`} />
            <span className="ds-mono text-[10px] uppercase tracking-[0.18em] text-ds-text-secondary">
              {mode === 'real_operation' ? 'REAL OPERATION' : mode === 'simulation' ? 'SIMULATION' : 'DESIGN'}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-ds-3">
          {tiles.map(({ icon: Icon, label, value, hint, tone }) => {
            const toneClass =
              tone === 'ok' ? 'text-status-ok'
              : tone === 'warn' ? 'text-status-warn'
              : 'text-status-sync';
            return (
              <div
                key={label}
                className="group rounded-ds-md border border-ds-border-subtle bg-ds-surface-elevated/60 px-ds-3 py-ds-3 transition-colors hover:border-status-sync/30"
              >
                <div className="flex items-center gap-ds-2">
                  <Icon className={`size-4 ${toneClass}`} aria-hidden />
                  <span className="ds-mono text-[9px] tracking-[0.18em] uppercase text-ds-text-muted">
                    {label}
                  </span>
                </div>
                <div className="mt-2 text-[22px] font-semibold text-ds-text-primary tabular-nums">
                  {value}
                </div>
                <div className="mt-0.5 text-[11px] text-ds-text-secondary">{hint}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
