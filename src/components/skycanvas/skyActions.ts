/**
 * skyActions — typed catalog for the SkyCanvas Master Menu palette.
 *
 * SAFETY: every action declares `safety: 'inert'`. The palette refuses to
 * register anything else. Real-operation commands MUST go through
 * uiCommandGateway in the /command surface, never here.
 */
export type SkyActionGroup = 'Navigation' | 'Audio' | 'Cues' | 'Layout' | 'Help';

export interface SkyAction {
  id: string;
  label: string;
  group: SkyActionGroup;
  kbd?: string;          // display only
  hint?: string;
  safety: 'inert';       // narrowed — see palette guard
  run: () => void | Promise<void>;
}

export interface SkyActionContext {
  togglePlay: () => void;
  stop: () => void;
  seekTo: (t: number) => void;
  pickAudio: () => void;
  focusPanel: (id: 'library' | 'inspector' | 'timeline') => void;
  toggleCinema: () => void;
  resetDock: () => void;
  goCommand: () => void;
}

export function buildSkyActions(ctx: SkyActionContext): SkyAction[] {
  return [
    // ── Audio ──
    { id: 'audio.load',   group: 'Audio',      label: 'Carregar trilha de áudio…', kbd: '⌘⇧A', safety: 'inert', run: ctx.pickAudio },
    { id: 'audio.play',   group: 'Audio',      label: 'Tocar / pausar',            kbd: 'Space', safety: 'inert', run: ctx.togglePlay },
    { id: 'audio.stop',   group: 'Audio',      label: 'Parar e voltar ao início',  kbd: 'Esc',   safety: 'inert', run: ctx.stop },
    { id: 'audio.seek0',  group: 'Audio',      label: 'Ir para o início',          kbd: 'Home',  safety: 'inert', run: () => ctx.seekTo(0) },

    // ── Layout ──
    { id: 'layout.lib',   group: 'Layout',     label: 'Foco · Biblioteca de efeitos', kbd: '⌘1', safety: 'inert', run: () => ctx.focusPanel('library') },
    { id: 'layout.insp',  group: 'Layout',     label: 'Foco · Inspector',             kbd: '⌘2', safety: 'inert', run: () => ctx.focusPanel('inspector') },
    { id: 'layout.tl',    group: 'Layout',     label: 'Foco · Timeline',              kbd: '⌘3', safety: 'inert', run: () => ctx.focusPanel('timeline') },
    { id: 'layout.cinema',group: 'Layout',     label: 'Modo cinema (ocultar painéis)',kbd: '⌘\\',safety: 'inert', run: ctx.toggleCinema },
    { id: 'layout.reset', group: 'Layout',     label: 'Restaurar layout padrão',      kbd: '⇧⌘0',safety: 'inert', run: ctx.resetDock },

    // ── Navigation ──
    { id: 'nav.command',  group: 'Navigation', label: 'Ir para Centro de Comando…', hint: 'Operação real via uiCommandGateway',
      safety: 'inert', run: ctx.goCommand },

    // ── Help ──
    { id: 'help.keys',    group: 'Help',       label: 'Atalhos de teclado',
      hint: 'Space · ←/→ · ⌘K · ⌘1/2/3 · ⌘\\',
      safety: 'inert',
      run: () => void import('sonner').then(({ toast }) =>
        toast('Space play · ←/→ frame · ⌘K menu · ⌘1/2/3 painéis · ⌘\\ cinema', { duration: 4000 }),
      ),
    },
  ];
}
