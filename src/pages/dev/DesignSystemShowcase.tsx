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
