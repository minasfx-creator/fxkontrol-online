import { useState, useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/** Keyboard shortcuts overlay */
export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: ['V'], desc: 'Select mode' },
    { keys: ['A'], desc: 'Toggle angle adjust mode' },
    { keys: ['E'], desc: 'Position editor popup' },
    { keys: ['Space'], desc: 'Play / Pause' },
    { keys: ['Shift', 'Click'], desc: 'Multi-select positions' },
    { keys: ['Ctrl', 'Drag'], desc: 'Snap to grid (0.5m)' },
    { keys: ['Ctrl', 'S'], desc: 'Save project' },
    { keys: ['Ctrl', 'O'], desc: 'Open project' },
    { keys: ['Del'], desc: 'Delete selected' },
    { keys: ['Ctrl', 'D'], desc: 'Duplicate selected' },
    { keys: ['Ctrl', 'Z'], desc: 'Undo' },
    { keys: ['Shift', '?'], desc: 'Show shortcuts' },
    { keys: ['Esc'], desc: 'Cancel / Close' },
  ];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-6 w-80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent/10 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.desc}</span>
              <div className="flex items-center gap-0.5">
                {s.keys.map((k, j) => (
                  <span key={j}>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono text-foreground">
                      {k}
                    </kbd>
                    {j < s.keys.length - 1 && <span className="text-[9px] text-muted-foreground mx-0.5">+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
