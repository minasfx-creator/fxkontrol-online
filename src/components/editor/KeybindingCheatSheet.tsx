/**
 * KeybindingCheatSheet — Modal showing all keyboard shortcuts
 * Triggered via '?' key or header icon.
 */
import { useState, useEffect } from 'react';
import { KEYBINDING_LIST } from '@/hooks/useKeybindings';
import { Keyboard, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function KeybindingCheatSheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(v => !v);
    window.addEventListener('toggle-keybinding-cheatsheet', handler);
    return () => window.removeEventListener('toggle-keybinding-cheatsheet', handler);
  }, []);

  if (!open) return null;

  const categories = [...new Set(KEYBINDING_LIST.map(k => k.category))];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="bg-card/95 backdrop-blur-xl border border-border/30 rounded-2xl shadow-2xl shadow-black/50 w-[420px] max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Atalhos de Teclado</h2>
          </div>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-3 space-y-4">
          {categories.map(cat => (
            <div key={cat}>
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50 mb-2">{cat}</h3>
              <div className="space-y-1">
                {KEYBINDING_LIST.filter(k => k.category === cat).map(kb => (
                  <div key={kb.key} className="flex items-center justify-between py-1">
                    <span className="text-xs text-foreground/80">{kb.action}</span>
                    <kbd className="px-2 py-0.5 rounded-md bg-muted/40 border border-border/20 text-[10px] font-mono text-primary font-bold min-w-[40px] text-center">
                      {kb.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border/20">
          <p className="text-[9px] text-muted-foreground/40 text-center">
            FX Kontrol v2.0 · Padrão Finale 3D · Pressione <kbd className="px-1 rounded bg-muted/30 text-muted-foreground">?</kbd> para fechar
          </p>
        </div>
      </div>
    </div>
  );
}

/** Trigger button for the header bar */
export function KeybindingTrigger() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('toggle-keybinding-cheatsheet'))}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all"
      title="Atalhos de Teclado (?)"
    >
      <Keyboard className="w-3.5 h-3.5" />
    </button>
  );
}
