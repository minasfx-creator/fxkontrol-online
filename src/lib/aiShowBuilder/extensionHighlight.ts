/**
 * extensionHighlight — pub/sub singleton para "replay visual do diff".
 *
 * O AIShowBuilderPanel publica o conjunto de IDs adicionados (cues, positions,
 * sections, trajectories) ao passar o mouse sobre uma entry do histórico.
 * Consumers (Timeline, Show3D overlay) podem assinar via subscribe() e
 * destacar visualmente esses elementos enquanto o highlight estiver ativo.
 *
 * Pure presentation. Não toca em ShowPlan, CommandBus ou safety.
 */

export interface ExtensionHighlight {
  entryId: string;
  cueIds: ReadonlySet<string>;
  positionIds: ReadonlySet<string>;
  sectionIds: ReadonlySet<string>;
  trajectoryIds: ReadonlySet<string>;
}

type Listener = (h: ExtensionHighlight | null) => void;

class ExtensionHighlightStore {
  private current: ExtensionHighlight | null = null;
  private listeners = new Set<Listener>();

  get(): ExtensionHighlight | null {
    return this.current;
  }

  set(h: ExtensionHighlight | null): void {
    if (this.current === h) return;
    // Evita re-broadcast se for o mesmo entryId (reentrance protection).
    if (this.current && h && this.current.entryId === h.entryId) return;
    this.current = h;
    this.listeners.forEach((l) => {
      try { l(h); } catch { /* listener errors must not break others */ }
    });
  }

  clear(entryId?: string): void {
    if (entryId && this.current?.entryId !== entryId) return;
    if (this.current === null) return;
    this.current = null;
    this.listeners.forEach((l) => {
      try { l(null); } catch { /* swallow */ }
    });
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  }

  /** Test helper — descarta tudo. */
  _reset(): void {
    this.current = null;
    this.listeners.clear();
  }
}

export const extensionHighlight = new ExtensionHighlightStore();
