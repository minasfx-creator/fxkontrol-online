/**
 * OfficeKpiHero — Welcome hero with key KPIs above hub cards.
 *
 * Light, presentation-only. Pulls counts from local stores when available
 * and falls back to honest "—" placeholders. Never queries hardware.
 */
import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Activity, GraduationCap, Cable, FolderOpen } from 'lucide-react';
import { MISSION_SCRIPTS } from '@/components/training/missions/missionScripts';

interface KpiTile {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
}

export default function OfficeKpiHero() {
  const { user } = useAuth();

  const tiles: KpiTile[] = useMemo(() => {
    const totalMissions = MISSION_SCRIPTS.length;
    const unlockedMissions = MISSION_SCRIPTS.filter((m) => !m.locked).length;
    return [
      { icon: FolderOpen,    label: 'Projetos recentes', value: '—',                                hint: 'Abra ou crie um show' },
      { icon: GraduationCap, label: 'Missões Training',  value: `${unlockedMissions}/${totalMissions}`, hint: 'Catálogo cinematográfico' },
      { icon: Cable,         label: 'Devices online',    value: '0',                                hint: 'Pareie via USB / BLE' },
      { icon: Activity,      label: 'Última operação',   value: 'Pronto',                           hint: 'Modo Simulação ativo' },
    ];
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return 'Boa madrugada';
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operador';

  return (
    <section className="bg-ds-background border-b border-ds-border-subtle px-ds-4 sm:px-ds-6 pt-ds-6 pb-ds-4">
      <div className="mx-auto max-w-6xl space-y-ds-4">
        <header>
          <p className="ds-mono text-[10px] tracking-[0.2em] uppercase text-status-sync/70">
            FX KONTROL · OFFICE
          </p>
          <h1 className="mt-1 text-[22px] sm:text-[28px] font-semibold text-ds-text-primary">
            {greeting}, <span className="text-status-sync">{displayName}</span>.
          </h1>
          <p className="mt-1 ds-caption">
            Visão geral em tempo real do seu universo operacional.
          </p>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-ds-3">
          {tiles.map(({ icon: Icon, label, value, hint }) => (
            <div
              key={label}
              className="rounded-ds-md border border-ds-border-subtle bg-ds-surface-elevated/60 px-ds-3 py-ds-3 transition-colors hover:border-status-sync/30"
            >
              <div className="flex items-center gap-ds-2">
                <Icon className="size-4 text-status-sync" aria-hidden />
                <span className="ds-mono text-[9px] tracking-[0.18em] uppercase text-ds-text-muted">
                  {label}
                </span>
              </div>
              <div className="mt-2 text-[22px] font-semibold text-ds-text-primary">{value}</div>
              <div className="mt-0.5 text-[11px] text-ds-text-secondary">{hint}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
