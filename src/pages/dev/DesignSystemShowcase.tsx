/**
 * /dev/design-system — FXKONTROL DS v1 Showcase
 *
 * Reference page for the FXKONTROL Design System (Night Mode, Vantablack,
 * Cyan / Green / Amber / Red semantics). Renders the additive token layer
 * (`--ds-*`, `--segment-*`, `--status-*`) so designers and engineers can:
 *   1. Verify color tokens render correctly in the browser.
 *   2. Copy/paste Tailwind class names for new components.
 *   3. See states (default / hover / active / disabled / safety-critical).
 *
 * All visuals are presentation-only: no business logic, no hardware calls,
 * no ARM. Safe to mount publicly under /dev/.
 *
 * Tokens are NOT redefined here — they live in src/index.css :root and
 * are exposed via tailwind.config.ts (`bg-ds-surface-panel`, `text-segment-pyro`,
 * `text-status-sync`, etc.).
 */
import {
  Flame, Sparkles, Send, Lightbulb, Sliders,
  ShieldCheck, Upload, TriangleAlert, OctagonAlert,
  LayoutTemplate, GraduationCap, Cpu, CheckCircle2,
} from 'lucide-react';

// ── Token tables ────────────────────────────────────────────────────────
const SURFACES = [
  { name: 'background',         className: 'bg-ds-background',         hex: '#050810' },
  { name: 'surface-deep',       className: 'bg-ds-surface-deep',       hex: '#0B1220' },
  { name: 'surface-panel',      className: 'bg-ds-surface-panel',      hex: '#111827' },
  { name: 'surface-elevated',   className: 'bg-ds-surface-elevated',   hex: '#172033' },
];

const BORDERS = [
  { name: 'border-default', className: 'border-ds-border-default', hex: '#1F2937' },
  { name: 'border-subtle',  className: 'border-ds-border-subtle',  hex: '#273244' },
  { name: 'border-active',  className: 'border-ds-border-active',  hex: '#22D3EE' },
];

const TEXT_TOKENS = [
  { name: 'text-primary',   className: 'text-ds-text-primary',   hex: '#E5E7EB' },
  { name: 'text-secondary', className: 'text-ds-text-secondary', hex: '#9CA3AF' },
  { name: 'text-muted',     className: 'text-ds-text-muted',     hex: '#6B7280' },
  { name: 'text-disabled',  className: 'text-ds-text-disabled',  hex: '#4B5563' },
];

const SEGMENTS = [
  { id: 'pyro',   label: 'PYRO',   icon: Flame,    hex: '#EF4444', tw: 'segment-pyro'   },
  { id: 'sfx',    label: 'SFX',    icon: Sparkles, hex: '#F59E0B', tw: 'segment-sfx'    },
  { id: 'drones', label: 'DRONES', icon: Send,     hex: '#22D3EE', tw: 'segment-drones' },
  { id: 'light',  label: 'LIGHT',  icon: Lightbulb,hex: '#FACC15', tw: 'segment-light'  },
  { id: 'dmx',    label: 'DMX',    icon: Sliders,  hex: '#8B5CF6', tw: 'segment-dmx'    },
] as const;

const STATUSES = [
  { name: 'OK',       className: 'text-status-ok',   bg: 'bg-status-ok/15',   border: 'border-status-ok/40',   hex: '#22C55E' },
  { name: 'SYNC',     className: 'text-status-sync', bg: 'bg-status-sync/15', border: 'border-status-sync/40', hex: '#22D3EE' },
  { name: 'WARNING',  className: 'text-status-warn', bg: 'bg-status-warn/15', border: 'border-status-warn/40', hex: '#F59E0B' },
  { name: 'FAIL',     className: 'text-status-fail', bg: 'bg-status-fail/15', border: 'border-status-fail/40', hex: '#EF4444' },
  { name: 'DISABLED', className: 'text-status-disabled', bg: 'bg-status-disabled/10', border: 'border-status-disabled/30', hex: '#6B7280' },
];

// ── Reusable section header ─────────────────────────────────────────────
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold tracking-tight text-ds-text-primary">{title}</h2>
        {subtitle && <p className="text-xs text-ds-text-muted mt-1">{subtitle}</p>}
      </header>
      <div className="rounded-[16px] border border-ds-border-default bg-ds-surface-panel p-6">
        {children}
      </div>
    </section>
  );
}

function TokenChip({ name, hex, swatch }: { name: string; hex: string; swatch: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-ds-border-subtle bg-ds-surface-deep p-3">
      {swatch}
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[11px] text-ds-text-primary truncate">{name}</div>
        <div className="font-mono text-[10px] text-ds-text-muted">{hex}</div>
      </div>
    </div>
  );
}

export default function DesignSystemShowcase() {
  return (
    <div
      className="min-h-screen w-full bg-ds-background text-ds-text-primary"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Header — Hero */}
      <header className="border-b border-ds-border-default bg-ds-surface-deep">
        <div className="mx-auto max-w-[1280px] px-8 py-12">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-status-sync">
            <span className="inline-block size-1.5 rounded-full bg-status-sync animate-pulse" />
            FXKONTROL · Design System v1
          </div>
          <h1 className="mt-3 text-[40px] leading-[48px] font-bold tracking-tight">
            Night Mode · Mission Control Console
          </h1>
          <p className="mt-3 max-w-2xl text-[16px] leading-[24px] text-ds-text-secondary">
            Vantablack base, Cyan = sync · Green = OK · Amber = warning · Red = critical.
            Tokens aditivos: <code className="font-mono text-status-sync">ds-*</code>,{' '}
            <code className="font-mono text-status-sync">segment-*</code>,{' '}
            <code className="font-mono text-status-sync">status-*</code>.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] space-y-12 px-8 py-12">
        {/* ── Surfaces ────────────────────────────────────────────────── */}
        <Section title="Surfaces" subtitle="Vantablack hierarchy. Panels go on surface-panel; nested panels on surface-elevated.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {SURFACES.map((s) => (
              <TokenChip
                key={s.name}
                name={s.className}
                hex={s.hex}
                swatch={<div className={`size-10 rounded-[8px] border border-ds-border-default ${s.className}`} />}
              />
            ))}
          </div>
        </Section>

        {/* ── Borders ─────────────────────────────────────────────────── */}
        <Section title="Borders" subtitle="Active border (cyan) reserved for focus, selection and sync states.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {BORDERS.map((b) => (
              <TokenChip
                key={b.name}
                name={b.className}
                hex={b.hex}
                swatch={<div className={`size-10 rounded-[8px] border-2 bg-ds-surface-deep ${b.className}`} />}
              />
            ))}
          </div>
        </Section>

        {/* ── Text ────────────────────────────────────────────────────── */}
        <Section title="Text" subtitle="Hierarchy: primary → secondary → muted → disabled.">
          <div className="space-y-2">
            {TEXT_TOKENS.map((t) => (
              <div key={t.name} className="flex items-center justify-between gap-4 rounded-[10px] border border-ds-border-subtle bg-ds-surface-deep p-3">
                <span className={`text-[14px] ${t.className}`}>The quick brown fox jumps over the lazy dog</span>
                <span className="font-mono text-[10px] text-ds-text-muted">{t.className} · {t.hex}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Segments ────────────────────────────────────────────────── */}
        <Section title="Segments" subtitle="Operational segments — used for tabs, badges, viewport objects and timeline tracks.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {SEGMENTS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  className="rounded-[16px] border border-ds-border-subtle bg-ds-surface-deep p-4 transition-all hover:border-ds-border-active hover:-translate-y-0.5"
                >
                  <Icon className="size-6" style={{ color: s.hex }} />
                  <div className="mt-3 text-[11px] font-mono uppercase tracking-wider" style={{ color: s.hex }}>
                    {s.label}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-ds-text-muted">text-{s.tw}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-ds-text-muted">{s.hex}</div>
                </div>
              );
            })}
          </div>

          {/* Segment tabs example */}
          <div className="mt-6">
            <div className="text-[11px] font-mono uppercase tracking-wider text-ds-text-muted mb-2">Segment Tabs</div>
            <div className="flex items-center gap-1 rounded-[12px] border border-ds-border-default bg-ds-surface-deep p-1">
              {SEGMENTS.map((s, i) => {
                const Icon = s.icon;
                const active = i === 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`relative flex items-center gap-2 rounded-[8px] px-3 py-2 text-[12px] font-medium transition-colors ${
                      active
                        ? 'text-ds-text-primary bg-ds-surface-elevated'
                        : 'text-ds-text-secondary hover:text-ds-text-primary'
                    }`}
                  >
                    <Icon className="size-3.5" style={{ color: s.hex }} />
                    {s.label}
                    {i === 0 && <span className="ml-1 rounded-full bg-segment-pyro/20 px-1.5 text-[10px] font-mono text-segment-pyro">12</span>}
                    {i === 4 && <span className="ml-1 text-[10px] text-status-warn">⚠ 3</span>}
                    {active && (
                      <span
                        className="absolute -bottom-1 left-2 right-2 h-[2px] rounded-full"
                        style={{ background: s.hex }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        {/* ── Status ──────────────────────────────────────────────────── */}
        <Section title="Status" subtitle="Functional states. Green = valid · Cyan = active/sync · Amber = attention · Red = critical/abort.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {STATUSES.map((s) => (
              <div
                key={s.name}
                className={`rounded-[10px] border ${s.border} ${s.bg} p-4 text-center`}
              >
                <div className={`text-[13px] font-mono font-semibold uppercase tracking-wider ${s.className}`}>{s.name}</div>
                <div className="mt-1 font-mono text-[10px] text-ds-text-muted">{s.hex}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Buttons ─────────────────────────────────────────────────── */}
        <Section title="Buttons" subtitle="Primary = ação principal · Cyan = ativa/sync · Danger = delete/abort/critical · Ghost = toolbar.">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="h-10 rounded-[10px] bg-status-sync px-4 text-[14px] font-semibold text-ds-background transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-sync focus-visible:ring-offset-2 focus-visible:ring-offset-ds-background"
            >
              Primary · Sync
            </button>
            <button
              type="button"
              className="h-10 rounded-[10px] border border-ds-border-default bg-ds-surface-elevated px-4 text-[14px] font-medium text-ds-text-primary transition-colors hover:border-ds-border-active hover:text-status-sync"
            >
              Secondary
            </button>
            <button
              type="button"
              className="h-10 rounded-[10px] px-4 text-[14px] font-medium text-ds-text-secondary transition-colors hover:bg-ds-surface-elevated hover:text-ds-text-primary"
            >
              Ghost
            </button>
            <button
              type="button"
              className="h-10 rounded-[10px] bg-status-fail px-4 text-[14px] font-semibold text-white transition-colors hover:brightness-110"
            >
              Danger · Abort
            </button>
            <button
              type="button"
              disabled
              className="h-10 rounded-[10px] border border-ds-border-default bg-ds-surface-deep px-4 text-[14px] font-medium text-ds-text-disabled cursor-not-allowed"
            >
              Disabled
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 max-w-md">
            <span className="rounded-[8px] border border-ds-border-subtle bg-ds-surface-deep px-3 py-2 text-center text-[11px] font-mono text-ds-text-muted">SM · h-8</span>
            <span className="rounded-[10px] border border-ds-border-subtle bg-ds-surface-deep px-3 py-2.5 text-center text-[12px] font-mono text-ds-text-muted">MD · h-10</span>
            <span className="rounded-[10px] border border-ds-border-subtle bg-ds-surface-deep px-3 py-3 text-center text-[13px] font-mono text-ds-text-muted">LG · h-12</span>
          </div>
        </Section>

        {/* ── Cards ───────────────────────────────────────────────────── */}
        <Section title="Cards" subtitle="Office actions, templates, landing use cases. Hover: cyan border + slight glow.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { icon: Flame,           title: 'New Show',  desc: 'Start from blank canvas. Full editor access.', cta: 'Create →' },
              { icon: LayoutTemplate,  title: 'Templates', desc: 'Pyro · Drones · Light. Pre-validated rigs.',   cta: 'Browse →' },
              { icon: GraduationCap,   title: 'Academy',   desc: 'Learn the cockpit. Safety-first onboarding.',  cta: 'Open →' },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.title}
                  className="group rounded-[16px] border border-ds-border-default bg-ds-surface-panel p-6 transition-all hover:border-ds-border-active hover:-translate-y-0.5"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
                >
                  <div className="inline-flex size-10 items-center justify-center rounded-[10px] border border-ds-border-subtle bg-ds-surface-elevated text-status-sync transition-colors group-hover:border-ds-border-active">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-[18px] font-semibold leading-[28px] text-ds-text-primary">{c.title}</h3>
                  <p className="mt-1 text-[14px] leading-[20px] text-ds-text-secondary">{c.desc}</p>
                  <div className="mt-4 text-[12px] font-mono uppercase tracking-wider text-status-sync">{c.cta}</div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── Badges ──────────────────────────────────────────────────── */}
        <Section title="Badges">
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => (
              <span
                key={s.id}
                className="rounded-[6px] border px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider"
                style={{
                  color: s.hex,
                  borderColor: `${s.hex}66`,
                  background: `${s.hex}14`,
                }}
              >
                {s.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-[6px] border border-status-ok/40 bg-status-ok/15 px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-status-ok">
              <CheckCircle2 className="size-3" /> OK
            </span>
            <span className="inline-flex items-center gap-1 rounded-[6px] border border-status-sync/40 bg-status-sync/15 px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-status-sync">
              <ShieldCheck className="size-3" /> SYNC
            </span>
            <span className="inline-flex items-center gap-1 rounded-[6px] border border-status-warn/40 bg-status-warn/15 px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-status-warn">
              <TriangleAlert className="size-3" /> WARN
            </span>
            <span className="inline-flex items-center gap-1 rounded-[6px] border border-status-fail/40 bg-status-fail/15 px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-status-fail">
              <OctagonAlert className="size-3" /> FAIL
            </span>
            <span className="rounded-[6px] border border-ds-border-default bg-ds-surface-elevated px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-ds-text-secondary">
              FIREONE
            </span>
            <span className="rounded-[6px] border border-ds-border-default bg-ds-surface-elevated px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-ds-text-secondary">
              ART-NET
            </span>
          </div>
        </Section>

        {/* ── Inputs ──────────────────────────────────────────────────── */}
        <Section title="Inputs" subtitle="Radius 8px. Focus = 2px cyan ring + offset 2px.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-mono uppercase tracking-wider text-ds-text-muted">Show Name</span>
              <input
                type="text"
                placeholder="e.g. New Year 2026 · Copacabana"
                className="h-10 w-full rounded-[8px] border border-ds-border-default bg-ds-surface-deep px-3 text-[14px] text-ds-text-primary placeholder:text-ds-text-muted focus:outline-none focus:border-ds-border-active focus:ring-2 focus:ring-status-sync/30"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-mono uppercase tracking-wider text-ds-text-muted">Timecode</span>
              <input
                type="text"
                defaultValue="00:00:00.000"
                className="h-10 w-full rounded-[8px] border border-ds-border-default bg-ds-surface-deep px-3 font-mono text-[14px] tabular-nums text-status-sync focus:outline-none focus:border-ds-border-active focus:ring-2 focus:ring-status-sync/30"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-mono uppercase tracking-wider text-ds-text-muted">Position (X · Y · Z)</span>
              <div className="grid grid-cols-3 gap-2">
                {['X', 'Y', 'Z'].map((axis) => (
                  <div key={axis} className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-ds-text-muted">{axis}</span>
                    <input
                      type="text"
                      defaultValue="0.000"
                      className="h-10 w-full rounded-[8px] border border-ds-border-default bg-ds-surface-deep pl-6 pr-2 font-mono text-[13px] tabular-nums text-ds-text-primary focus:outline-none focus:border-ds-border-active focus:ring-2 focus:ring-status-sync/30"
                    />
                  </div>
                ))}
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-mono uppercase tracking-wider text-ds-text-muted">Channel</span>
              <input
                type="number"
                defaultValue={1}
                min={1}
                max={512}
                className="h-10 w-full rounded-[8px] border border-ds-border-default bg-ds-surface-deep px-3 font-mono text-[14px] tabular-nums text-ds-text-primary focus:outline-none focus:border-ds-border-active focus:ring-2 focus:ring-status-sync/30"
              />
            </label>
          </div>
        </Section>

        {/* ── Tool Items (safety-critical) ────────────────────────────── */}
        <Section title="Tool Items" subtitle="Toolbar buttons. Safety-critical = amber border + warning icon.">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex items-center gap-1.5 rounded-[8px] border border-transparent bg-ds-surface-deep px-2.5 py-1.5 text-[12px] text-ds-text-secondary transition-colors hover:border-ds-border-subtle hover:text-ds-text-primary">
              <Send className="size-3.5" /> Select
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-[8px] border border-ds-border-active bg-status-sync/10 px-2.5 py-1.5 text-[12px] text-status-sync transition-colors">
              <Send className="size-3.5" /> Move <span className="ml-1 font-mono text-[10px] text-ds-text-muted">M</span>
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-[8px] border border-status-warn/40 bg-status-warn/10 px-2.5 py-1.5 text-[12px] text-status-warn transition-colors hover:bg-status-warn/15" title="Safety-critical">
              <TriangleAlert className="size-3.5" /> Arm
            </button>
            <button type="button" disabled className="inline-flex items-center gap-1.5 rounded-[8px] border border-ds-border-default bg-ds-surface-deep px-2.5 py-1.5 text-[12px] text-ds-text-disabled cursor-not-allowed">
              <Upload className="size-3.5" /> Export
            </button>
          </div>
        </Section>

        {/* ── System States ───────────────────────────────────────────── */}
        <Section title="System States">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Empty */}
            <div className="rounded-[12px] border border-dashed border-ds-border-subtle bg-ds-surface-deep p-8 text-center">
              <Cpu className="mx-auto size-8 text-ds-text-muted" />
              <h4 className="mt-3 text-[16px] font-semibold text-ds-text-primary">No project yet.</h4>
              <p className="mt-1 text-[13px] text-ds-text-secondary">Create your first show to get started.</p>
              <button type="button" className="mt-4 h-10 rounded-[10px] bg-status-sync px-4 text-[13px] font-semibold text-ds-background hover:brightness-110">
                + New Show
              </button>
            </div>
            {/* Critical */}
            <div className="rounded-[12px] border border-status-fail/40 bg-status-fail/10 p-6" style={{ boxShadow: '0 0 16px rgba(239,68,68,0.25)' }}>
              <div className="flex items-start gap-3">
                <OctagonAlert className="mt-0.5 size-5 text-status-fail" />
                <div>
                  <h4 className="text-[14px] font-semibold text-status-fail">Critical · ARM blocked</h4>
                  <p className="mt-1 text-[13px] text-ds-text-secondary">Continuity check failed on channel 7. Resolve and retry.</p>
                  <button type="button" className="mt-3 h-9 rounded-[8px] border border-status-fail/40 bg-status-fail/15 px-3 text-[12px] font-semibold text-status-fail hover:bg-status-fail/25">
                    Open Diagnostics
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Typography ──────────────────────────────────────────────── */}
        <Section title="Typography" subtitle="Spec scale: H1 48 / H2 32 / H3 24 / Body 16 / Caption 12. Family: Rajdhani (project default).">
          <div className="space-y-4">
            <div className="ds-h1 text-ds-text-primary">H1 · Mission Control</div>
            <div className="ds-h2 text-ds-text-primary">H2 · Show Authoring</div>
            <div className="ds-h3 text-ds-text-primary">H3 · Segment Inspector</div>
            <div className="ds-body text-ds-text-secondary">Body · Operator messages, descriptions, inline help. Stays legible at 16px on dark surfaces and meets WCAG AA against ds-surface-panel.</div>
            <div className="ds-caption">Caption · meta, units, hints (12px, muted).</div>
            <div className="ds-mono text-status-sync text-[13px]">ds-mono · 00:00:00.000 · TC SYNC</div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5 text-[10px] font-mono text-ds-text-muted">
              {[
                ['ds-h1', '48 / 700'],
                ['ds-h2', '32 / 600'],
                ['ds-h3', '24 / 500'],
                ['ds-body', '16 / 400'],
                ['ds-caption', '12 / 400'],
              ].map(([cls, meta]) => (
                <div key={cls} className="rounded-[6px] border border-ds-border-subtle bg-ds-surface-deep px-2 py-1.5">
                  <div className="text-ds-text-secondary">{cls}</div>
                  <div>{meta}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Spacing 8pt ─────────────────────────────────────────────── */}
        <Section title="Spacing · 8pt scale" subtitle="4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Use ds-{1,2,3,4,6,8,12,16} on padding/gap.">
          <div className="space-y-2">
            {[
              { tok: 'ds-1',  px: 4,  cls: 'w-1' },
              { tok: 'ds-2',  px: 8,  cls: 'w-2' },
              { tok: 'ds-3',  px: 3,  cls: 'w-3' },
              { tok: 'ds-4',  px: 16, cls: 'w-4' },
              { tok: 'ds-6',  px: 24, cls: 'w-6' },
              { tok: 'ds-8',  px: 32, cls: 'w-8' },
              { tok: 'ds-12', px: 48, cls: 'w-12' },
              { tok: 'ds-16', px: 64, cls: 'w-16' },
            ].map((s) => (
              <div key={s.tok} className="flex items-center gap-3">
                <div className="h-3 rounded-[2px] bg-status-sync" style={{ width: `${s.px}px` }} />
                <code className="font-mono text-[11px] text-ds-text-secondary">{s.tok}</code>
                <span className="font-mono text-[10px] text-ds-text-muted">{s.px}px</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Radius ──────────────────────────────────────────────────── */}
        <Section title="Radius" subtitle="Spec: sm 6 (badges/chips) · md 10 (buttons/inputs/cards) · lg 16 (panels/modals).">
          <div className="grid grid-cols-3 gap-4">
            {[
              { tok: 'rounded-ds-sm', label: 'SM · 6',  cls: 'rounded-ds-sm' },
              { tok: 'rounded-ds-md', label: 'MD · 10', cls: 'rounded-ds-md' },
              { tok: 'rounded-ds-lg', label: 'LG · 16', cls: 'rounded-ds-lg' },
            ].map((r) => (
              <div key={r.tok} className="space-y-2">
                <div className={`h-20 border border-ds-border-active bg-ds-surface-elevated ${r.cls}`} />
                <div className="font-mono text-[11px] text-ds-text-secondary">{r.tok}</div>
                <div className="font-mono text-[10px] text-ds-text-muted">{r.label}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── States Matrix ───────────────────────────────────────────── */}
        <Section title="States Matrix" subtitle="Default · Hover · Active · Focus · Disabled — applied to a generic .ds-interactive button.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { label: 'Default',  className: 'ds-interactive ds-panel' },
              { label: 'Hover',    className: 'ds-interactive ds-panel bg-ds-surface-elevated border-ds-border-subtle' },
              { label: 'Active',   className: 'ds-interactive ds-panel ds-active-border text-status-sync' },
              { label: 'Focus',    className: 'ds-interactive ds-panel', extra: { boxShadow: 'var(--ds-focus-ring)' } },
              { label: 'Disabled', className: 'ds-interactive ds-panel', disabled: true },
            ].map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={s.disabled}
                className={`h-12 px-3 rounded-ds-md text-[12px] font-mono uppercase tracking-wider ${s.className}`}
                style={s.extra}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-3 ds-caption">Cyan = ativo/sync · Verde = OK · Âmbar = warn · Vermelho = critical. Foco usa cyan ring de 2px.</p>
        </Section>

        {/* ── Screens (wireframes) ────────────────────────────────────── */}
        <Section title="Screens · Wireframes" subtitle="Maquetes em escala reduzida das 5 telas-chave (Landing · Office · Create · Validation · Export). Constraints e auto-layout conforme handoff.">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Landing */}
            <div className="rounded-ds-md border border-ds-border-default overflow-hidden">
              <div className="flex items-center justify-between bg-ds-surface-deep px-3 py-2 border-b border-ds-border-default">
                <span className="ds-caption uppercase tracking-wider text-ds-text-secondary">Landing · 1440 × Auto</span>
                <span className="font-mono text-[9px] text-ds-text-muted">marketing</span>
              </div>
              <div className="bg-ds-background p-3 space-y-2 text-[10px] font-mono text-ds-text-muted">
                <div className="h-6 rounded-ds-sm bg-ds-surface-panel border border-ds-border-default flex items-center px-2">Navbar 72</div>
                <div className="h-24 rounded-ds-sm bg-ds-surface-panel border border-ds-border-default grid grid-cols-2 gap-2 p-2">
                  <div className="rounded-ds-sm bg-ds-surface-deep flex flex-col justify-center p-2">
                    <div className="h-2 w-3/4 bg-ds-text-disabled/40 rounded mb-1" />
                    <div className="h-2 w-1/2 bg-ds-text-disabled/30 rounded mb-2" />
                    <div className="h-4 w-20 bg-status-sync/40 rounded-ds-sm" />
                  </div>
                  <div className="rounded-ds-sm border border-status-sync/30 bg-ds-background flex items-center justify-center text-status-sync">Hero Preview</div>
                </div>
                <div className="h-10 rounded-ds-sm bg-ds-surface-panel border border-ds-border-default flex items-center px-2">How it works · 300</div>
                <div className="h-8 rounded-ds-sm bg-ds-surface-panel border border-ds-border-default flex items-center px-2">Capabilities · 200</div>
                <div className="h-8 rounded-ds-sm bg-ds-surface-panel border border-ds-border-default flex items-center px-2">Use Cases · 200</div>
                <div className="h-8 rounded-ds-sm bg-ds-surface-panel border border-status-sync/40 flex items-center px-2 text-status-sync">CTA · 200</div>
                <div className="h-5 rounded-ds-sm bg-ds-surface-panel border border-ds-border-default flex items-center px-2">Footer 120</div>
              </div>
            </div>

            {/* Office */}
            <div className="rounded-ds-md border border-ds-border-default overflow-hidden">
              <div className="flex items-center justify-between bg-ds-surface-deep px-3 py-2 border-b border-ds-border-default">
                <span className="ds-caption uppercase tracking-wider text-ds-text-secondary">Office · 1440 × 900</span>
                <span className="font-mono text-[9px] text-ds-text-muted">dashboard</span>
              </div>
              <div className="bg-ds-background p-3 text-[10px] font-mono text-ds-text-muted">
                <div className="h-5 rounded-ds-sm bg-ds-surface-deep border border-ds-border-default flex items-center px-2 mb-3">Topbar 64</div>
                <div className="ds-caption mb-2 uppercase tracking-wider">Quick Actions · 2×2 · gap 24</div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {['New Show', 'Templates', 'Recent', 'Academy'].map((c) => (
                    <div key={c} className="h-14 rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-2 flex items-end text-ds-text-primary">{c}</div>
                  ))}
                </div>
                <div className="ds-caption mb-1 uppercase tracking-wider">Recent Projects</div>
                <div className="space-y-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-6 rounded-ds-sm bg-ds-surface-panel border border-ds-border-default flex items-center justify-between px-2">
                      <span>Project · {i}</span><span className="ds-dot ds-dot-ok" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Create flow */}
            <div className="rounded-ds-md border border-ds-border-default overflow-hidden">
              <div className="flex items-center justify-between bg-ds-surface-deep px-3 py-2 border-b border-ds-border-default">
                <span className="ds-caption uppercase tracking-wider text-ds-text-secondary">Create · 960 × Auto · centralizado</span>
                <span className="font-mono text-[9px] text-ds-text-muted">wizard</span>
              </div>
              <div className="bg-ds-background p-3 text-[10px] font-mono text-ds-text-muted">
                <div className="ds-caption mb-2 uppercase tracking-wider">Mode Selector · W 600 · gap 16</div>
                <div className="space-y-2 mb-3">
                  {['Blank Canvas', 'From Template', 'AI Generate'].map((m, i) => (
                    <div key={m} className={`h-10 rounded-ds-md border bg-ds-surface-panel flex items-center px-3 ${i === 0 ? 'border-status-sync text-status-sync' : 'border-ds-border-default text-ds-text-primary'}`}>{m}</div>
                  ))}
                </div>
                <div className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-3">
                  <div className="ds-caption uppercase tracking-wider mb-2">Step Container · padding 24</div>
                  <div className="h-12 rounded-ds-sm bg-ds-surface-deep mb-3" />
                  <div className="flex items-center justify-between">
                    <span className="rounded-ds-sm border border-ds-border-default px-2 py-1">← Back</span>
                    <span className="rounded-ds-sm bg-status-sync px-2 py-1 text-ds-background">Continue →</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Validation + Export modals */}
            <div className="rounded-ds-md border border-ds-border-default overflow-hidden">
              <div className="flex items-center justify-between bg-ds-surface-deep px-3 py-2 border-b border-ds-border-default">
                <span className="ds-caption uppercase tracking-wider text-ds-text-secondary">Modals · Validation · Export</span>
                <span className="font-mono text-[9px] text-ds-text-muted">overlays</span>
              </div>
              <div className="bg-ds-background p-3 grid grid-cols-2 gap-3 text-[10px] font-mono text-ds-text-muted">
                <div className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-3">
                  <div className="ds-caption uppercase tracking-wider mb-2 text-ds-text-primary">Validation · 480</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2"><span className="text-status-ok">✔</span><span>Continuity OK</span></div>
                    <div className="flex items-center gap-2"><span className="text-status-warn">⚠</span><span>3 channels low V</span></div>
                    <div className="flex items-center gap-2"><span className="text-status-fail">✕</span><span>Cue 045 unmapped</span></div>
                  </div>
                  <div className="mt-3 h-6 rounded-ds-sm bg-status-sync flex items-center justify-center text-ds-background">Fix Issues</div>
                </div>
                <div className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-3">
                  <div className="ds-caption uppercase tracking-wider mb-2 text-ds-text-primary">Export · 400</div>
                  <div className="space-y-1">
                    {['FireOne', 'DMX', 'Drone API', 'PDF'].map((o, i) => (
                      <div key={o} className="flex items-center gap-2">
                        <span className={`size-2.5 rounded-full border ${i === 0 ? 'bg-status-sync border-status-sync' : 'border-ds-border-default'}`} />
                        <span>{o}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 h-6 rounded-ds-sm bg-status-sync flex items-center justify-center text-ds-background">Export</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-ds-md border border-status-sync/30 bg-status-sync/10 px-4 py-3">
            <div>
              <div className="text-[12px] font-semibold text-status-sync">Editor Shell · live demo</div>
              <p className="ds-caption text-ds-text-secondary mt-0.5">
                Preview interativo do <code className="font-mono">&lt;EditorShell&gt;</code> com Topbar · Tabs · Panels · Timeline · Viewport.
              </p>
            </div>
            <a
              href="/dev/editor-shell"
              className="rounded-ds-md bg-status-sync px-4 py-2 text-[12px] font-semibold text-ds-background hover:brightness-110"
            >
              Abrir /dev/editor-shell →
            </a>
          </div>
        </Section>

        {/* ── Editor Shell Preview ────────────────────────────────────── */}
        <Section title="Editor Shell" subtitle="Constraints layout (não auto-layout). Topbar 64 · Tabs 48 · Left 280 · Right 320 · Timeline 180 · Viewport fill.">
          <div className="rounded-ds-md border border-ds-border-default overflow-hidden">
            <div className="ds-editor-grid" style={{ height: 360 }}>
              <div className="ds-area-topbar bg-ds-surface-deep flex items-center px-4 gap-3">
                <div className="ds-dot ds-dot-sync" />
                <span className="font-mono text-[11px] uppercase tracking-wider text-ds-text-secondary">FXKONTROL · Show · Untitled</span>
                <div className="flex-1" />
                <span className="ds-status-sync text-[10px] font-mono px-2 py-0.5 rounded-ds-sm">SAVE</span>
                <span className="ds-status-warn text-[10px] font-mono px-2 py-0.5 rounded-ds-sm">VALIDATE</span>
                <span className="ds-status-ok   text-[10px] font-mono px-2 py-0.5 rounded-ds-sm">EXPORT</span>
              </div>
              <div className="ds-area-tabs bg-ds-surface-panel flex items-end gap-0 px-2">
                {SEGMENTS.map((s, i) => (
                  <div key={s.id} className={`px-3 py-2 text-[11px] font-mono uppercase tracking-wider ${i === 0 ? 'text-ds-text-primary ds-segment-pyro-bar' : 'text-ds-text-muted'}`}>
                    {s.label}
                  </div>
                ))}
              </div>
              <div className="ds-area-left bg-ds-surface-deep p-3 space-y-2">
                {['Selection', 'Edit', 'Patch', 'Safety'].map((g) => (
                  <div key={g} className="ds-caption uppercase tracking-wider">{g}</div>
                ))}
              </div>
              <div className="ds-area-viewport bg-ds-background flex items-center justify-center">
                <span className="ds-caption">VIEWPORT · fill remaining</span>
              </div>
              <div className="ds-area-right bg-ds-surface-deep p-3 space-y-2">
                {['Position', 'Rotation (YZX)', 'Timing', 'Channel'].map((g) => (
                  <div key={g} className="ds-caption uppercase tracking-wider">{g}</div>
                ))}
              </div>
              <div className="ds-area-timeline bg-ds-surface-panel p-2">
                <div className="ds-caption uppercase tracking-wider">Timeline · tracks por segmento</div>
              </div>
            </div>
          </div>
          <p className="mt-3 ds-caption">
            Use <code className="font-mono text-status-sync">.ds-editor-grid</code> + áreas (
            <code className="font-mono">.ds-area-topbar/tabs/left/viewport/right/timeline</code>).
          </p>
        </Section>

        {/* ── Theming note ────────────────────────────────────────────── */}
        <Section title="Theming · Dark / Light" subtitle="DS v1 é dark-first (Vantablack). Light-mode é fora de escopo: o editor é safety-critical e operacional.">
          <ul className="ds-body text-ds-text-secondary space-y-1.5 list-disc pl-5">
            <li>Tokens semânticos (<code className="font-mono text-status-sync">--ds-*</code>, <code className="font-mono">--segment-*</code>, <code className="font-mono">--status-*</code>) são a única superfície pública. Componentes <strong>nunca</strong> hardcodam cores.</li>
            <li>Para um light-mode futuro, redefina <code className="font-mono">--ds-background/surface/text/border</code> em <code className="font-mono">.light</code> — segments e status mantêm a mesma matiz.</li>
            <li>Cyan = ativo/sync · Verde = validado · Âmbar = atenção · Vermelho = crítico. Estas semânticas são <strong>imutáveis</strong> entre temas.</li>
            <li>Foco sempre cyan, ring 2px com offset 2px (<code className="font-mono">--ds-focus-ring</code>) — atende WCAG AA.</li>
          </ul>
        </Section>

        {/* Footer */}
        <footer className="border-t border-ds-border-default pt-6 pb-12 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ds-text-muted">
            FXKONTROL · Design System v1 · Reference page · Read-only · No hardware calls
          </p>
        </footer>
      </main>
    </div>
  );
}
