/**
 * ─── Render Counter Debug Overlay ───────────────────────────────────
 * Shows live re-render counts for instrumented components.
 * Toggle with Ctrl+Shift+R (Cmd+Shift+R on Mac).
 * Dev-only — tree-shaken in production.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getRenderCounters, subscribeRenderCounters, resetRenderCounters } from '@/hooks/useRenderCounter';

export default function RenderCounterOverlay() {
  const [visible, setVisible] = useState(false);
  const [counters, setCounters] = useState<Record<string, number>>({});
  const rafRef = useRef<number | null>(null);

  // Subscribe to counter updates and batch via rAF
  useEffect(() => {
    if (!visible) return;

    const update = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setCounters({ ...getRenderCounters() });
      });
    };

    // Initial read
    setCounters({ ...getRenderCounters() });

    const unsub = subscribeRenderCounters(update);
    return () => {
      unsub();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [visible]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      setVisible(v => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!visible) return null;

  const entries = Object.entries(counters).sort((a, b) => b[1] - a[1]);

  return (
    <div
      className="fixed z-[99999] font-mono text-[10px] leading-tight pointer-events-auto select-none"
      style={{
        top: 8,
        right: 8,
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid hsl(32 100% 50% / 0.25)',
        borderRadius: 8,
        padding: '8px 10px',
        minWidth: 180,
        maxHeight: '50vh',
        overflowY: 'auto',
        color: 'hsl(32 100% 70%)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="tracking-widest uppercase text-[9px] opacity-70">
          ⚡ Render Counts
        </span>
        <button
          onClick={() => {
            resetRenderCounters();
            setCounters({});
          }}
          className="text-[8px] uppercase tracking-wider opacity-50 hover:opacity-100 transition-opacity"
          title="Reset counters"
        >
          Reset
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="opacity-40 text-[9px]">No instrumented components</div>
      ) : (
        entries.map(([name, count]) => (
          <div key={name} className="flex justify-between gap-3 py-px">
            <span className="truncate opacity-80">{name}</span>
            <span
              style={{
                color: count > 100 ? '#ff4444' : count > 30 ? '#ffaa00' : '#66ff66',
              }}
            >
              {count}
            </span>
          </div>
        ))
      )}

      <div className="mt-1.5 pt-1 border-t border-white/10 text-[8px] opacity-30 text-center">
        Ctrl+Shift+R to toggle
      </div>
    </div>
  );
}
