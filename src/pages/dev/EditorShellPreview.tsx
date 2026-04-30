/**
 * /dev/editor-shell — Live demo of <EditorShell> with the FXKONTROL DS.
 *
 * Pure presentation. No store, no hardware, no ARM. Safe public route.
 * Mirrors the Editor screen spec in the Figma handoff doc:
 *   Topbar 64 · Tabs 48 · Left 280 · Right 320 · Timeline 180 · Viewport fill.
 */
import { useEffect, useState } from 'react';
import {
  Save, ShieldCheck, Upload, User2,
  Flame, Sparkles, Send, Lightbulb, Sliders,
  MousePointer2, Pencil, Wrench, AlertTriangle,
  Move3d, RotateCcw, Clock, Cable, HelpCircle,
} from 'lucide-react';
import {
  EditorShell, DsButton, DsPanel, DsPanelTitle,
  DsSegmentTabs, DsToolItem, type SegmentItem,
  DsSkeleton, DsPanelSkeleton, DsViewportSkeleton,
} from '@/components/ds';
import EditorShellOnboardingDialog, { ONBOARDING_KEY } from './EditorShellOnboardingDialog';

const SEGMENTS: SegmentItem[] = [
  { id: 'pyro',   label: 'PYRO',   icon: Flame,
    badge: <span className="rounded-ds-sm bg-segment-pyro/20 px-1.5 text-[10px] font-mono text-segment-pyro">12</span> },
  { id: 'sfx',    label: 'SFX',    icon: Sparkles,
    badge: <span className="rounded-ds-sm bg-segment-sfx/20 px-1.5 text-[10px] font-mono text-segment-sfx">4</span> },
  { id: 'drones', label: 'DRONES', icon: Send,
    badge: <span className="rounded-ds-sm bg-segment-drones/20 px-1.5 text-[10px] font-mono text-segment-drones">120</span> },
  { id: 'light',  label: 'LIGHT',  icon: Lightbulb },
  { id: 'dmx',    label: 'DMX',    icon: Sliders,
    badge: <span className="text-[10px] font-mono text-status-warn">⚠ 3</span> },
];

export default function EditorShellPreview() {
  const [active, setActive] = useState('pyro');

  /**
   * Staged boot for honest perceived performance:
   *   stage 0 (0–220ms)  → chrome skeletons (panels grayed)
   *   stage 1 (220–650ms)→ chrome ready, viewport still loading
   *   stage 2 (≥650ms)   → fully painted, fade-in viewport content
   *
   * Mirrors what a real Studio mount does (assets, GPGPU warmup, ShowPlan
   * hydration). Pure presentation here — no real async work.
   */
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    const t1 = window.setTimeout(() => setStage(1), 220);
    const t2 = window.setTimeout(() => setStage(2), 650);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, []);

  // SEO — title/description/canonical + OpenGraph/Twitter for /editor-ds.
  // Same direct-DOM pattern used by /pricing and /legal/* (no helmet dep).
  useEffect(() => {
    const prevTitle = document.title;
    const TITLE = 'Editor DS — Shell Preview · FX KONTROL';
    const DESC =
      'Editor DS v1: shell de edição (Topbar/Tabs/Inspector/Timeline) do FX KONTROL para shows pirotécnicos, drones e laser.';
    const URL = 'https://www.fxkontrol.online/editor-ds';

    document.title = TITLE;

    const ensureMeta = (selectorAttr: 'name' | 'property', key: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[${selectorAttr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(selectorAttr, key);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    ensureMeta('name', 'description', DESC);
    ensureMeta('property', 'og:title', TITLE);
    ensureMeta('property', 'og:description', DESC);
    ensureMeta('property', 'og:type', 'website');
    ensureMeta('property', 'og:url', URL);
    ensureMeta('name', 'twitter:card', 'summary_large_image');
    ensureMeta('name', 'twitter:title', TITLE);
    ensureMeta('name', 'twitter:description', DESC);

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    const prevCanonical = canonical.href;
    canonical.href = URL;

    return () => {
      document.title = prevTitle;
      if (canonical) canonical.href = prevCanonical;
    };
  }, []);

  const chromeReady = stage >= 1;
  const viewportReady = stage >= 2;

  /**
   * Onboarding modal — first visit only (persisted in localStorage).
   * Reopen via Help button (?) in topbar or "?" key.
   */
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) setOnboardingOpen(true);
    } catch {
      // localStorage may be blocked (private mode) — fail open: show once per session.
      setOnboardingOpen(true);
    }
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Avoid stealing "?" from inputs/textareas.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === '?') {
        e.preventDefault();
        setOnboardingOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const markOnboarded = () => {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div className="h-[100dvh] w-full bg-ds-background text-ds-text-primary"
         style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Semantic H1 for SEO — visually hidden, narrated by screen readers. */}
      <h1 className="sr-only">Editor DS — Shell Preview · FX KONTROL</h1>
      <EditorShell
        topbar={
          <div className="flex h-full items-center justify-between px-ds-4">
            <div className="flex items-center gap-ds-3">
              <div className="flex size-8 items-center justify-center rounded-ds-md bg-status-sync text-ds-background font-bold">FX</div>
              <div className="flex flex-col leading-tight">
                <span className="text-ds-caption text-ds-text-muted">Project</span>
                <span className="text-[14px] font-semibold">Reveillon · Copacabana 2026</span>
              </div>
              <span className="ml-ds-3 inline-flex items-center gap-1 rounded-ds-sm border border-status-sync/40 bg-status-sync/15 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-status-sync">
                <span className="size-1.5 rounded-full bg-status-sync animate-pulse" />
                SYNC
              </span>
            </div>
            <div className="flex items-center gap-ds-2">
              <DsButton variant="ghost" size="sm"><Save className="size-4" />Save</DsButton>
              <DsButton variant="secondary" size="sm"><ShieldCheck className="size-4" />Validate</DsButton>
              <DsButton variant="primary" size="sm"><Upload className="size-4" />Export</DsButton>
              <button
                type="button"
                onClick={() => setOnboardingOpen(true)}
                title="Tour & atalhos (?)"
                aria-label="Abrir tour e atalhos"
                className="ml-ds-2 flex size-8 items-center justify-center rounded-full border border-ds-border-default bg-ds-surface-elevated text-ds-text-secondary hover:text-status-sync hover:border-status-sync/40 transition-colors"
              >
                <HelpCircle className="size-4" />
              </button>
              <button className="flex size-8 items-center justify-center rounded-full border border-ds-border-default bg-ds-surface-elevated text-ds-text-secondary hover:text-ds-text-primary">
                <User2 className="size-4" />
              </button>
            </div>
          </div>
        }
        tabs={
          <div className="flex h-full items-center px-ds-4">
            {chromeReady ? (
              <DsSegmentTabs items={SEGMENTS} activeId={active} onChange={setActive} colorPerSegment />
            ) : (
              <div className="flex items-center gap-ds-2">
                {SEGMENTS.map((_, i) => (
                  <DsSkeleton key={i} h="h-7" w="w-20" rounded="md" />
                ))}
              </div>
            )}
          </div>
        }
        left={
          <div className="flex h-full flex-col gap-ds-4 p-ds-4 overflow-y-auto">
            {!chromeReady ? (
              <>
                <DsPanelSkeleton rows={3} />
                <DsPanelSkeleton rows={3} />
                <DsPanelSkeleton rows={2} />
              </>
            ) : (
              <div className="flex flex-col gap-ds-4 animate-in fade-in duration-300">
                <DsPanel>
                  <DsPanelTitle>Selection</DsPanelTitle>
                  <div className="flex flex-col gap-1">
                    <DsToolItem icon={MousePointer2} label="Select" shortcut="V" active />
                    <DsToolItem icon={Move3d}        label="Move"   shortcut="W" />
                    <DsToolItem icon={RotateCcw}     label="Rotate" shortcut="E" />
                  </div>
                </DsPanel>
                <DsPanel>
                  <DsPanelTitle>Edit</DsPanelTitle>
                  <div className="flex flex-col gap-1">
                    <DsToolItem icon={Pencil} label="Sketch"  shortcut="K" />
                    <DsToolItem icon={Wrench} label="Patch"   shortcut="P" />
                    <DsToolItem icon={Cable}  label="Channel" shortcut="C" />
                  </div>
                </DsPanel>
                <DsPanel>
                  <DsPanelTitle>Safety</DsPanelTitle>
                  <div className="flex flex-col gap-1">
                    <DsToolItem icon={ShieldCheck}   label="Continuity" shortcut="G" />
                    <DsToolItem icon={AlertTriangle} label="E-Stop"     shortcut="␣" critical />
                  </div>
                </DsPanel>
              </div>
            )}
          </div>
        }
        right={
          <div className="flex h-full flex-col gap-ds-4 p-ds-4 overflow-y-auto">
            {!chromeReady ? (
              <>
                <DsPanelSkeleton rows={3} />
                <DsPanelSkeleton rows={3} />
                <DsPanelSkeleton rows={3} />
                <DsPanelSkeleton rows={3} />
              </>
            ) : (
              <div className="flex flex-col gap-ds-4 animate-in fade-in duration-300">
                <DsPanel>
                  <DsPanelTitle>Inspector</DsPanelTitle>
                  <Field label="Cue ID"   value="PYRO.045" mono />
                  <Field label="Channel"  value="CH 12" mono />
                  <Field label="Type"     value="Comet · 30°" />
                </DsPanel>
                <DsPanel>
                  <DsPanelTitle>Position (YZX)</DsPanelTitle>
                  <NumRow a="Y" b="Z" c="X" va="0.00" vb="1.70" vc="-12.40" />
                </DsPanel>
                <DsPanel>
                  <DsPanelTitle>Rotation (P/T/S)</DsPanelTitle>
                  <NumRow a="Pan" b="Tilt" c="Spin" va="180°" vb="62°" vc="0°" />
                </DsPanel>
                <DsPanel>
                  <DsPanelTitle>Timing</DsPanelTitle>
                  <Field label="Start"    value="00:00:12.400" mono />
                  <Field label="Duration" value="0.85 s"        mono />
                  <Field label="Pre-fire" value="120 ms"        mono />
                </DsPanel>
              </div>
            )}
          </div>
        }
        timeline={
          <div className="flex h-full flex-col">
            <div className="flex h-8 items-center justify-between border-b border-ds-border-default px-ds-4">
              <div className="flex items-center gap-ds-3">
                <span className="text-ds-caption font-mono text-ds-text-muted">TIMELINE</span>
                <span className="rounded-ds-sm border border-status-sync/40 bg-status-sync/10 px-2 py-0.5 text-[10px] font-mono text-status-sync">
                  00:00:12.400
                </span>
              </div>
              <div className="flex items-center gap-ds-2 text-ds-caption font-mono text-ds-text-muted">
                <span>BPM 120</span><span>·</span><span>FPS 30</span><span>·</span><span>SMPTE 29.97</span>
              </div>
            </div>
            <div className="relative flex-1 overflow-hidden">
              {/* Time ruler */}
              <div className="flex h-5 items-end border-b border-ds-border-default bg-ds-surface-deep px-ds-4 text-[9px] font-mono text-ds-text-muted">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex-1 border-l border-ds-border-default pl-1">{`00:${(i * 5).toString().padStart(2, '0')}`}</div>
                ))}
              </div>
              {/* Tracks */}
              {!viewportReady
                ? SEGMENTS.map((seg, idx) => (
                    <div
                      key={seg.id}
                      className="relative flex h-7 items-center gap-ds-2 border-b border-ds-border-default/60 px-ds-4"
                    >
                      <DsSkeleton h="h-3" w="w-16" />
                      <DsSkeleton h="h-4" w={`w-[${20 + idx * 8}%]`} />
                    </div>
                  ))
                : SEGMENTS.map((seg, idx) => (
                    <Track key={seg.id} label={seg.label} colorVar={`--segment-${seg.id}`} active={seg.id === active} offset={idx} />
                  ))}
              {/* Playhead */}
              <div className="pointer-events-none absolute top-0 bottom-0" style={{ left: '24%' }}>
                <div className="h-full w-px bg-status-sync" />
                <div className="absolute -top-px -left-1 size-2 rotate-45 bg-status-sync" />
              </div>
            </div>
          </div>
        }
      >
        {/* Viewport — placeholder com grade técnica */}
        {!viewportReady ? (
          <DsViewportSkeleton label="Booting viewport · DS" />
        ) : (
        <div className="relative h-full w-full overflow-hidden animate-in fade-in duration-500">
          <div className="absolute inset-0 opacity-[0.18]"
               style={{
                 backgroundImage:
                   'linear-gradient(rgba(34,211,238,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.18) 1px, transparent 1px)',
                 backgroundSize: '40px 40px',
               }} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(34,211,238,0.08),_transparent_60%)]" />
          <div className="absolute left-ds-4 top-ds-4 flex items-center gap-ds-2 rounded-ds-md border border-ds-border-default bg-ds-surface-deep/80 px-ds-3 py-ds-2 backdrop-blur">
            <span className="size-1.5 rounded-full bg-status-ok animate-pulse" />
            <span className="text-ds-caption font-mono text-ds-text-secondary">VIEWPORT · DESIGN MODE</span>
          </div>
          <div className="absolute right-ds-4 top-ds-4 rounded-ds-md border border-ds-border-default bg-ds-surface-deep/80 px-ds-3 py-ds-2 font-mono text-ds-caption text-ds-text-muted backdrop-blur">
            12 cues · 0 errors · 0 warnings
          </div>

          {/* Centered "stage" */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-ds-4 flex size-16 items-center justify-center rounded-full border border-status-sync/40 bg-status-sync/10 text-status-sync">
                <Flame className="size-7" />
              </div>
              <div className="ds-h3 text-ds-text-primary">Editor Shell · DS v1</div>
              <p className="mt-ds-2 max-w-md text-ds-body text-ds-text-secondary">
                Topbar 64 · Tabs 48 · Left 280 · Right 320 · Timeline 180 · Viewport fill.
                Constraints, não auto-layout.
              </p>
            </div>
          </div>

          {/* Guide overlay (bottom-right) */}
          <div className="absolute bottom-ds-4 right-ds-4 w-72 rounded-ds-lg border border-status-sync/40 bg-ds-surface-panel p-ds-4 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-ds-2 text-ds-caption font-mono uppercase tracking-wider text-status-sync">
              <span className="size-1.5 rounded-full bg-status-sync animate-pulse" />
              Guide
            </div>
            <div className="mt-ds-2 text-[14px] font-semibold text-ds-text-primary">Next step: Create PYRO sequence</div>
            <p className="mt-1 text-ds-caption text-ds-text-secondary">
              Selecione um cue ou peça pra IA gerar uma sequência inicial baseada no template atual.
            </p>
            <div className="mt-ds-3 flex justify-end">
              <DsButton size="sm" variant="primary">Auto Create</DsButton>
            </div>
          </div>
        </div>
        )}
      </EditorShell>

      <EditorShellOnboardingDialog
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onDontShowAgain={markOnboarded}
      />
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-ds-3 border-b border-ds-border-subtle/60 py-ds-2 last:border-0">
      <span className="text-ds-caption text-ds-text-muted">{label}</span>
      <span className={`text-[12px] text-ds-text-primary ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function NumRow({ a, b, c, va, vb, vc }: { a: string; b: string; c: string; va: string; vb: string; vc: string }) {
  return (
    <div className="grid grid-cols-3 gap-ds-2">
      {[[a, va], [b, vb], [c, vc]].map(([k, v]) => (
        <div key={k} className="rounded-ds-sm border border-ds-border-subtle bg-ds-surface-deep p-ds-2">
          <div className="text-[10px] font-mono uppercase text-ds-text-muted">{k}</div>
          <div className="mt-0.5 font-mono text-[12px] text-ds-text-primary">{v}</div>
        </div>
      ))}
    </div>
  );
}

function Track({ label, colorVar, active, offset }: { label: string; colorVar: string; active: boolean; offset: number }) {
  // Deterministic blocks per segment so layout stays stable.
  const blocks = [
    { left: 8 + offset * 4, width: 14 },
    { left: 32 + offset * 3, width: 8 },
    { left: 55 + offset * 2, width: 18 },
  ];
  return (
    <div className="relative flex h-7 items-center border-b border-ds-border-default/60 px-ds-4">
      <div className="z-10 w-16 shrink-0 text-[10px] font-mono uppercase tracking-wider"
           style={{ color: `hsl(var(${colorVar}, 0 0% 60%))`, opacity: active ? 1 : 0.6 }}>
        {label}
      </div>
      <div className="relative h-full flex-1">
        {blocks.map((b, i) => (
          <div key={i}
               className="absolute top-1 h-5 rounded-ds-sm"
               style={{
                 left: `${b.left}%`,
                 width: `${b.width}%`,
                 background: `var(${colorVar})`,
                 opacity: active ? 0.85 : 0.35,
                 boxShadow: active ? `0 0 8px var(${colorVar})` : 'none',
               }} />
        ))}
      </div>
    </div>
  );
}
