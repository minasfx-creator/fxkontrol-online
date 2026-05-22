/**
 * EditorShellOnboardingDialog — first-visit explainer for /editor-ds.
 *
 * Pure presentation. Explains the 5 panels (Topbar/Tabs/Left/Right/Timeline)
 * + essential keyboard shortcuts. Dismissal persisted in localStorage so
 * the user only sees it once unless they click the help button.
 *
 * Open state is controlled by parent (so the page can re-trigger it).
 */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { DsButton } from '@/components/ds';
import {
  LayoutGrid, Layers, MousePointer2, Sliders, Clock, Keyboard,
  type LucideIcon,
} from 'lucide-react';

export const ONBOARDING_KEY = 'fxk:editor-ds:onboarded:v1';

interface PanelDef {
  icon: LucideIcon;
  title: string;
  desc: string;
  accent: string; // tailwind text color class for icon
}

const PANELS: PanelDef[] = [
  { icon: LayoutGrid,    title: 'Topbar (64)',     desc: 'Identidade do projeto, status SYNC, ações Save / Validate / Export.', accent: 'text-status-sync' },
  { icon: Layers,        title: 'Tabs (48)',       desc: 'Segmentos PYRO · SFX · DRONES · LIGHT · DMX. Cada um troca o contexto da viewport.', accent: 'text-segment-pyro' },
  { icon: MousePointer2, title: 'Left Tools (280)',desc: 'Selection, Edit, Safety. Tools agrupadas por contexto, com atalhos.', accent: 'text-status-ok' },
  { icon: Sliders,       title: 'Right Inspector (320)', desc: 'Cue ID, Position (YZX), Rotation (P/T/S), Timing. Edição precisa do selecionado.', accent: 'text-segment-drones' },
  { icon: Clock,         title: 'Timeline (180)',  desc: 'Tracks por segmento, playhead, ruler SMPTE 29.97. Snap a 30/50/90 px.', accent: 'text-status-warn' },
];

interface ShortcutDef { keys: string[]; label: string }

const SHORTCUTS: ShortcutDef[] = [
  { keys: ['V'],         label: 'Select' },
  { keys: ['W'],         label: 'Move' },
  { keys: ['E'],         label: 'Rotate' },
  { keys: ['K'],         label: 'Sketch' },
  { keys: ['P'],         label: 'Patch' },
  { keys: ['C'],         label: 'Channel' },
  { keys: ['G'],         label: 'Continuity check' },
  { keys: ['Space'],     label: 'Play / Pause' },
  { keys: ['⌘', 'M'],    label: 'Master Menu' },
  { keys: ['⌘', 'S'],    label: 'Save' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when user dismisses with "Don't show again". */
  onDontShowAgain?: () => void;
}

export default function EditorShellOnboardingDialog({ open, onOpenChange, onDontShowAgain }: Props) {
  const handleStart = () => {
    onDontShowAgain?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-ds-surface-panel border-ds-border-default text-ds-text-primary p-0 overflow-hidden">
        <DialogHeader className="px-ds-6 pt-ds-6 pb-ds-3 border-b border-ds-border-subtle">
          <div className="flex items-center gap-ds-3">
            <div className="grid size-10 place-items-center rounded-ds-md border border-status-sync/40 bg-status-sync/10 text-status-sync">
              <LayoutGrid className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-[18px] font-semibold leading-tight">
                Bem-vindo ao Editor DS
              </DialogTitle>
              <DialogDescription className="text-ds-caption text-ds-text-secondary mt-0.5">
                Tour rápido (30s) pelos painéis e atalhos antes de começar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-ds-6 py-ds-4 space-y-ds-5">
          {/* Panels */}
          <section>
            <h3 className="text-ds-caption font-mono uppercase tracking-[0.18em] text-ds-text-muted mb-ds-3">
              Painéis
            </h3>
            <ul className="space-y-ds-2">
              {PANELS.map(({ icon: Icon, title, desc, accent }) => (
                <li
                  key={title}
                  className="flex items-start gap-ds-3 rounded-ds-md border border-ds-border-subtle bg-ds-surface-deep/60 p-ds-3"
                >
                  <Icon className={`size-4 shrink-0 mt-0.5 ${accent}`} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-ds-text-primary">{title}</div>
                    <div className="text-[12px] text-ds-text-secondary mt-0.5">{desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Shortcuts */}
          <section>
            <h3 className="text-ds-caption font-mono uppercase tracking-[0.18em] text-ds-text-muted mb-ds-3 flex items-center gap-ds-2">
              <Keyboard className="size-3.5" />
              Atalhos essenciais
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-ds-2">
              {SHORTCUTS.map(({ keys, label }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-ds-3 rounded-ds-sm border border-ds-border-subtle bg-ds-surface-deep/60 px-ds-3 py-ds-2"
                >
                  <span className="text-[12px] text-ds-text-secondary">{label}</span>
                  <span className="flex items-center gap-1">
                    {keys.map((k) => (
                      <kbd
                        key={k}
                        className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-ds-sm border border-ds-border-default bg-ds-surface-elevated px-1.5 font-mono text-[10px] text-ds-text-primary"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter className="px-ds-6 py-ds-4 border-t border-ds-border-subtle bg-ds-surface-deep/40 sm:justify-between gap-ds-2">
          <p className="text-[11px] text-ds-text-muted">
            Pressione <kbd className="font-mono">?</kbd> a qualquer momento para reabrir.
          </p>
          <div className="flex gap-ds-2">
            <DsButton variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Pular
            </DsButton>
            <DsButton variant="primary" size="sm" onClick={handleStart}>
              Começar
            </DsButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
