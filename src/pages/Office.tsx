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
  const navigate = useNavigate();
  const { isAdmin } = useAdminRole();
  const activeTab = (params.get('tab') as TabKey) || 'overview';

  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.adminOnly || isAdmin),
    [isAdmin]
  );

  const setTab = useCallback((key: TabKey) => {
    const next = new URLSearchParams(params);
    next.set('tab', key);
    setParams(next, { replace: false });
  }, [params, setParams]);

  const goOverview = useCallback(() => setTab('overview'), [setTab]);

  // ── Keyboard shortcuts ──
  // ⌘1..⌘9 (or Alt+1..9) jump directly to a visible tab.
  // Ctrl/Cmd + ← / → cycle through tabs.
  // Ignored when typing in inputs/textareas/contenteditable.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tgt?.isContentEditable) return;

      const mod = e.metaKey || e.ctrlKey || e.altKey;
      if (!mod) return;

      // Direct jump: Cmd/Ctrl/Alt + 1..9
      if (/^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        if (idx < visibleTabs.length) {
          e.preventDefault();
          setTab(visibleTabs[idx].key);
        }
        return;
      }

      // Cycle: Cmd/Ctrl + ← / →
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const cur = visibleTabs.findIndex((t) => t.key === activeTab);
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = (cur + dir + visibleTabs.length) % visibleTabs.length;
        setTab(visibleTabs[next].key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visibleTabs, activeTab, setTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Dashboard />;
      case 'agenda':
        return (
          <Placeholder
            title="Agenda"
            desc="Eventos & datas — em consolidação na próxima etapa do refactor."
            onBack={goOverview}
          />
        );
      case 'tasks':
        return (
          <Placeholder
            title="Tasks & Checklists"
            desc="Kanban estilo ClickUp + checklists por evento. Será entregue na Etapa 3 do refactor (após Studio AI-First)."
            onBack={goOverview}
          />
        );
      case 'documents':
        return <AccreditationDashboard />;
      case 'compliance':
        return isAdmin ? (
          <Placeholder
            title="Compliance / Admin"
            desc="Painel de administração unificado — em consolidação na próxima etapa do refactor."
            onBack={goOverview}
          />
        ) : (
          <Placeholder
            title="Compliance"
            desc="Acesso restrito a administradores. Solicite permissão ao administrador da conta."
            onBack={goOverview}
          />
        );
      case 'reports':
        return (
          <Placeholder
            title="Reports Executivos"
            desc="Relatórios consolidados (executive_reports) com export PDF. Próxima etapa."
            onBack={goOverview}
          />
        );
      case 'training':
        return (
          <div className="mx-auto max-w-2xl px-ds-6 py-24 text-center animate-fade-in">
            <div className="mx-auto mb-ds-4 grid size-12 place-items-center rounded-full border border-ds-border-subtle bg-ds-surface-elevated text-status-sync">
              <GraduationCap className="size-5" />
            </div>
            <h2 className="text-[24px] font-semibold text-ds-text-primary mb-ds-2">Training Center</h2>
            <p className="text-[14px] text-ds-text-secondary leading-relaxed">
              Tutoriais interativos e simulação guiada estão disponíveis no Training Center completo.
            </p>
            <div className="mt-ds-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/training/center')}
                className="inline-flex items-center gap-2 rounded-ds-md border border-status-sync/40 bg-status-sync/10 px-4 py-2 text-[12px] font-medium text-status-sync hover:bg-status-sync/20 transition-colors ds-focus"
              >
                Abrir Training Center →
              </button>
              <button
                type="button"
                onClick={goOverview}
                className="inline-flex items-center gap-2 rounded-ds-md border border-ds-border-default bg-ds-surface-elevated px-3 py-2 text-[12px] text-ds-text-primary hover:bg-status-sync/10 hover:border-status-sync/40 transition-colors ds-focus"
              >
                <ArrowLeft className="size-3.5" /> Voltar
              </button>
            </div>
          </div>
        );
      case 'joi':
        return <JoiPanel />;
      default:
        return <Dashboard />;
    }
  };

  const activeIndex = visibleTabs.findIndex((t) => t.key === activeTab);

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
        aria-label="Seções do Office"
        className="sticky top-0 z-20 flex items-center gap-ds-1 overflow-x-auto px-ds-3 py-ds-2 border-b border-ds-border-default bg-ds-surface-deep/80 backdrop-blur scrollbar-thin shrink-0"
      >
        {visibleTabs.map((tab, idx) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          const shortcut = idx < 9 ? `⌘${idx + 1}` : '';
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              aria-controls={`office-panel-${tab.key}`}
              id={`office-tab-${tab.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(tab.key)}
              title={`${tab.label} — ${tab.desc}${shortcut ? ` (${shortcut})` : ''}`}
              className={`group relative inline-flex items-center gap-ds-2 shrink-0 rounded-ds-md px-ds-3 py-ds-2 text-[12px] font-medium transition-all ds-focus ${
                active
                  ? 'bg-status-sync/10 text-status-sync ds-active-border border'
                  : 'border border-transparent text-ds-text-secondary hover:text-ds-text-primary hover:bg-ds-surface-elevated'
              }`}
            >
              <Icon className={`size-3.5 shrink-0 transition-transform ${active ? 'scale-110' : 'group-hover:scale-105'}`} />
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.adminOnly && (
                <span className="ds-mono text-[8px] tracking-widest text-status-warn/80 uppercase rounded border border-status-warn/30 bg-status-warn/10 px-1 py-px leading-none">
                  ADM
                </span>
              )}
            </button>
          );
        })}
        <span
          className="hidden md:inline ml-auto pl-ds-3 ds-mono text-[10px] text-ds-text-muted/70 tracking-wider whitespace-nowrap"
          aria-hidden
        >
          ⌘1–{Math.min(9, visibleTabs.length)} · ⌘← / ⌘→
        </span>
      </nav>

      {/* Tab content — each lazy-loaded page renders inside */}
      <div
        className="flex-1 min-h-0"
        role="tabpanel"
        id={`office-panel-${activeTab}`}
        aria-labelledby={`office-tab-${activeTab}`}
        key={activeTab /* fade-in on tab change */}
      >
        <Suspense fallback={<Loader label={`Carregando ${visibleTabs[activeIndex]?.label ?? 'painel'}…`} />}>
          <div className="animate-fade-in">{renderContent()}</div>
        </Suspense>
      </div>
    </div>
  );
}

