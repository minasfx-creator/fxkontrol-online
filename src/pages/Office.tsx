/**
 * ─── Office ─────────────────────────────────────────────────────────
 * Área 1 de 3 da plataforma refatorada (Office | Studio | Command).
 *
 * Consolida produtividade administrativa em uma rota única (/office) com
 * sub-tabs via ?tab=... — reaproveita páginas existentes sem duplicar lógica.
 *
 * Tabs:
 *   overview    → Dashboard atual (visão geral / KPIs)
 *   agenda      → Agenda (eventos)
 *   tasks       → Placeholder ClickUp-style (Etapa 3)
 *   documents   → Compliance/Accreditation (documentação)
 *   compliance  → Admin (gestão plataforma) — admin-only
 *   reports     → Executive reports — placeholder p/ próxima etapa
 *   training    → Training (tutoriais)
 *   joi         → JOI Assistant
 */
import { lazy, Suspense, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  ListChecks,
  FileText,
  ShieldCheck,
  BarChart3,
  GraduationCap,
  Sparkles,
  Hammer,
  ArrowLeft,
} from 'lucide-react';
import { useAdminRole } from '@/hooks/useAdminRole';

const Dashboard = lazy(() => import('@/components/office/DashboardPanel'));
const AccreditationDashboard = lazy(() => import('@/components/office/AccreditationPanel'));
const JoiPanel = lazy(() => import('@/ai/ui/JoiPanel'));
import OfficeHubCards from '@/features/office/OfficeHubCards';
import OfficeKpiHero from '@/features/office/OfficeKpiHero';

type TabKey =
  | 'overview'
  | 'agenda'
  | 'tasks'
  | 'documents'
  | 'compliance'
  | 'reports'
  | 'training'
  | 'joi';

interface TabDef {
  key: TabKey;
  label: string;
  desc: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const TABS: TabDef[] = [
  { key: 'overview', label: 'Visão Geral', desc: 'KPIs do evento', icon: LayoutDashboard },
  { key: 'agenda', label: 'Agenda', desc: 'Eventos & datas', icon: CalendarDays },
  { key: 'tasks', label: 'Tasks', desc: 'Checklists & kanban', icon: ListChecks },
  { key: 'documents', label: 'Documentos', desc: 'Validação & vencimentos', icon: FileText },
  { key: 'compliance', label: 'Compliance', desc: 'Gestão plataforma', icon: ShieldCheck, adminOnly: true },
  { key: 'reports', label: 'Reports', desc: 'Relatórios executivos', icon: BarChart3 },
  { key: 'training', label: 'Training', desc: 'Tutoriais & simulação', icon: GraduationCap },
  { key: 'joi', label: 'JOI Assistant', desc: 'Coreografia IA', icon: Sparkles },
];

const Loader = ({ label = 'Carregando…' }: { label?: string }) => (
  <div className="flex flex-col items-center justify-center gap-ds-3 py-24" role="status" aria-live="polite">
    <div className="size-6 rounded-full border-2 border-status-sync border-t-transparent animate-spin" />
    <span className="ds-caption text-ds-text-secondary">{label}</span>
  </div>
);

const Placeholder = ({
  title,
  desc,
  onBack,
}: {
  title: string;
  desc: string;
  onBack?: () => void;
}) => (
  <div className="mx-auto max-w-2xl px-ds-6 py-24 text-center animate-fade-in">
    <div className="mx-auto mb-ds-4 grid size-12 place-items-center rounded-full border border-ds-border-subtle bg-ds-surface-elevated text-status-sync">
      <Hammer className="size-5" />
    </div>
    <span className="inline-flex items-center gap-1.5 rounded-full border border-status-warn/30 bg-status-warn/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-status-warn mb-ds-3">
      Em construção
    </span>
    <h2 className="text-[24px] font-semibold text-ds-text-primary mb-ds-2">{title}</h2>
    <p className="text-[14px] text-ds-text-secondary leading-relaxed">{desc}</p>
    {onBack && (
      <button
        type="button"
        onClick={onBack}
        className="mt-ds-6 inline-flex items-center gap-2 rounded-ds-md border border-ds-border-default bg-ds-surface-elevated px-3 py-2 text-[12px] text-ds-text-primary hover:bg-status-sync/10 hover:border-status-sync/40 transition-colors ds-focus"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para Visão Geral
      </button>
    )}
  </div>
);

export default function Office() {
  const [params, setParams] = useSearchParams();
  const { isAdmin } = useAdminRole();
  const activeTab = (params.get('tab') as TabKey) || 'overview';

  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.adminOnly || isAdmin),
    [isAdmin]
  );

  const setTab = (key: TabKey) => {
    const next = new URLSearchParams(params);
    next.set('tab', key);
    setParams(next, { replace: false });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Dashboard />;
      case 'agenda':
        return (
          <Placeholder
            title="Agenda"
            desc="Eventos & datas — em consolidação na próxima etapa do refactor."
          />
        );
      case 'tasks':
        return (
          <Placeholder
            title="Tasks & Checklists"
            desc="Kanban estilo ClickUp + checklists por evento. Será entregue na Etapa 3 do refactor (após Studio AI-First)."
          />
        );
      case 'documents':
        return <AccreditationDashboard />;
      case 'compliance':
        return isAdmin ? (
          <Placeholder
            title="Compliance / Admin"
            desc="Painel de administração unificado — em consolidação na próxima etapa do refactor."
          />
        ) : (
          <Placeholder title="Compliance" desc="Acesso restrito a administradores." />
        );
      case 'reports':
        return (
          <Placeholder
            title="Reports Executivos"
            desc="Relatórios consolidados (executive_reports) com export PDF. Próxima etapa."
          />
        );
      case 'training':
        return (
          <Placeholder
            title="Training"
            desc="Acesse o Training Center completo em /training/center."
          />
        );
      case 'joi':
        return <JoiPanel />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100dvh-3rem)] w-full bg-ds-background text-ds-text-primary">
      {/* Hero KPI strip + Hub cards — Blueprint UX entry points (above the tab strip) */}
      {activeTab === 'overview' && (
        <>
          <OfficeKpiHero />
          <OfficeHubCards />
        </>
      )}

      {/* Tab strip — horizontal, scrollable on mobile (DS tokens) */}
      <nav
        role="tablist"
        className="flex items-center gap-ds-1 overflow-x-auto px-ds-3 py-ds-2 border-b border-ds-border-default bg-ds-surface-deep/60 backdrop-blur scrollbar-thin shrink-0"
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tab.key)}
              className={`inline-flex items-center gap-ds-2 shrink-0 rounded-ds-md px-ds-3 py-ds-2 text-[12px] font-medium transition-colors ds-focus ${
                active
                  ? 'bg-status-sync/10 text-status-sync ds-active-border border'
                  : 'border border-transparent text-ds-text-secondary hover:text-ds-text-primary hover:bg-ds-surface-elevated'
              }`}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Tab content — each lazy-loaded page renders inside */}
      <div className="flex-1 min-h-0">
        <Suspense fallback={<Loader />}>{renderContent()}</Suspense>
      </div>
    </div>
  );
}

