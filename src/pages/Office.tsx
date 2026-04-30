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
import { lazy, Suspense, useMemo } from 'react';
import { useSearchParams, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  ListChecks,
  FileText,
  ShieldCheck,
  BarChart3,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { useAdminRole } from '@/hooks/useAdminRole';

const Dashboard = lazy(() => import('./Dashboard'));
const Agenda = lazy(() => import('./Agenda'));
const Training = lazy(() => import('./Training'));
const Admin = lazy(() => import('./Admin'));
const AccreditationDashboard = lazy(() => import('./AccreditationDashboard'));
const JoiPanel = lazy(() => import('@/ai/ui/JoiPanel'));

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

const Loader = () => (
  <div className="flex items-center justify-center py-24">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const Placeholder = ({ title, desc }: { title: string; desc: string }) => (
  <div className="max-w-2xl mx-auto px-6 py-24 text-center">
    <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
    <p className="text-sm text-muted-foreground">{desc}</p>
    <p className="mt-6 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
      Em desenvolvimento — próxima etapa do refactor
    </p>
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
        return <Agenda />;
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
          <Admin />
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
        return <Training />;
      case 'joi':
        return <JoiPanel />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100dvh-3rem)] w-full">
      {/* Hub cards — Blueprint UX entry points (above the tab strip) */}
      {activeTab === 'overview' && <OfficeHubCards />}

      {/* Tab strip — horizontal, scrollable on mobile */}
      <nav
        className="flex items-center gap-1 px-3 py-2 border-b overflow-x-auto scrollbar-thin shrink-0"
        style={{
          background: 'hsl(var(--surface-0) / 0.6)',
          borderColor: 'hsl(32 100% 50% / 0.1)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 shrink-0 ${
                active
                  ? 'shadow-[inset_0_0_0_1px_hsl(32_100%_50%/0.2)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
              }`}
              style={
                active
                  ? {
                      background: 'hsl(32 100% 50% / 0.1)',
                      color: 'hsl(32 100% 50%)',
                    }
                  : undefined
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
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

