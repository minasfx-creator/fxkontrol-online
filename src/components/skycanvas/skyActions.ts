/**
 * skyActions — typed catalog for the SkyCanvas Master Menu palette.
 *
 * SAFETY: every action declares `safety: 'inert'`. The palette refuses to
 * register anything else. Real-operation commands MUST go through
 * uiCommandGateway in the /command surface, never here.
 */
export type SkyActionGroup = 'Navigation' | 'Audio' | 'Cues' | 'Layout' | 'Project' | 'Help';

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
  toggleLeft: () => void;
  toggleRight: () => void;
  toggleTimeline: () => void;
  resetLayout: () => void;
  goCommand: () => void;
  goAiBuilder: () => void;
  goStrategy: () => void;
  openImportVdl: () => void;
  exportShowJson: () => void;
  resetShow: () => void;
}

export function buildSkyActions(ctx: SkyActionContext): SkyAction[] {
  return [
    // ── Audio ──
    { id: 'audio.load',   group: 'Audio',      label: 'Carregar trilha de áudio…', kbd: '⌘⇧A', safety: 'inert', run: ctx.pickAudio },
    { id: 'audio.play',   group: 'Audio',      label: 'Tocar / pausar',            kbd: 'Space', safety: 'inert', run: ctx.togglePlay },
    { id: 'audio.stop',   group: 'Audio',      label: 'Parar e voltar ao início',  kbd: 'Esc',   safety: 'inert', run: ctx.stop },
    { id: 'audio.seek0',  group: 'Audio',      label: 'Ir para o início',          kbd: 'Home',  safety: 'inert', run: () => ctx.seekTo(0) },

    // ── Layout ──
    { id: 'layout.left',  group: 'Layout',     label: 'Alternar painel · Biblioteca', kbd: '⌘1', safety: 'inert', run: ctx.toggleLeft },
    { id: 'layout.right', group: 'Layout',     label: 'Alternar painel · Inspector',  kbd: '⌘2', safety: 'inert', run: ctx.toggleRight },
    { id: 'layout.tl',    group: 'Layout',     label: 'Alternar painel · Timeline',   kbd: '⌘3', safety: 'inert', run: ctx.toggleTimeline },
    { id: 'layout.reset', group: 'Layout',     label: 'Restaurar layout padrão',      kbd: '⇧⌘0',safety: 'inert', run: ctx.resetLayout },

    // ── Project ──
    { id: 'project.importVdl', group: 'Project', label: 'Importar catálogo VDL/CSV…',
      hint: 'Drop-in catalog importer (RFC 4180)',
      safety: 'inert', run: ctx.openImportVdl },
    { id: 'project.exportJson', group: 'Project', label: 'Exportar show (JSON bundle)',
      hint: 'Inspect-only download — não dispara hardware',
      safety: 'inert', run: ctx.exportShowJson },
    { id: 'project.resetShow', group: 'Project', label: 'Apagar show e limpar autosave…',
      hint: 'Limpa cues e fxk.skycanvas.show.v1 (confirmação)',
      safety: 'inert', run: ctx.resetShow },

    // ── Navigation ──
    { id: 'nav.aiBuilder', group: 'Navigation', label: 'Abrir AI Show Builder…',
      hint: 'Geração assistida (LLM, sandboxed)',
      safety: 'inert', run: ctx.goAiBuilder },
    { id: 'nav.strategy',  group: 'Navigation', label: 'Strategic Command Hub…',
      hint: 'GTM · demo sessions · client approval',
      safety: 'inert', run: ctx.goStrategy },
    { id: 'nav.command',   group: 'Navigation', label: 'Ir para Centro de Comando…',
      hint: 'Operação real via uiCommandGateway',
      safety: 'inert', run: ctx.goCommand },

    // ── Help ──
    { id: 'help.keys',    group: 'Help',       label: 'Atalhos de teclado',
      hint: 'Space · ←/→ · ⌘K · ⌘1/2/3 · ⇧⌘0',
      safety: 'inert',
      run: () => void import('sonner').then(({ toast }) =>
        toast('Space play · ←/→ frame · ⌘K menu · ⌘1/2/3 painéis · ⇧⌘0 reset', { duration: 4000 }),
      ),
    },
  ];
}
