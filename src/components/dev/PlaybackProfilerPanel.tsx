/**
 * PlaybackProfilerPanel — dev-only overlay that controls the playback
 * profiler and renders the latest report (per component + per store).
 *
 * Shown only in dev (import.meta.env.DEV) and only when toggled with
 * Ctrl+Shift+P. Uses semantic Tailwind tokens (no raw colors) to stay
 * inside the FX KONTROL Vantablack design system.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  startPlaybackProfiler,
  stopPlaybackProfiler,
  getReport,
  clearProfilerSamples,
  isProfilerArmed,
  subscribeProfilerArmed,
  type PlaybackProfilerReport,
} from '@/core/performance/PlaybackProfiler';

function useArmed() {
  return useSyncExternalStore(subscribeProfilerArmed, isProfilerArmed, () => false);
}

export function PlaybackProfilerPanel() {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<PlaybackProfilerReport | null>(null);
  const armed = useArmed();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Refresh report every 500ms while armed, plus on transitions
  useEffect(() => {
    if (!open) return;
    const tick = () => setReport(getReport());
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [open, armed]);

  if (!import.meta.env.DEV || !open) return null;

  const fmt = (n: number) => n.toFixed(1);

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] w-[520px] max-h-[70vh] overflow-hidden rounded-lg border border-border bg-background/95 backdrop-blur shadow-2xl text-xs font-mono"
      role="dialog"
      aria-label="Playback Profiler"
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${armed ? 'bg-destructive animate-pulse' : 'bg-muted-foreground'}`}
            aria-label={armed ? 'recording' : 'idle'}
          />
          <span className="font-semibold tracking-wide uppercase">Playback Profiler</span>
        </div>
        <div className="flex items-center gap-1">
          {armed ? (
            <button
              type="button"
              className="px-2 py-1 rounded bg-destructive/20 text-destructive hover:bg-destructive/30"
              onClick={() => setReport(stopPlaybackProfiler())}
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30"
              onClick={() => {
                clearProfilerSamples();
                startPlaybackProfiler();
              }}
            >
              Start
            </button>
          )}
          <button
            type="button"
            className="px-2 py-1 rounded bg-muted hover:bg-muted/70"
            onClick={() => {
              clearProfilerSamples();
              setReport(getReport());
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded bg-muted hover:bg-muted/70"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </header>

      {report && (
        <div className="overflow-auto max-h-[calc(70vh-44px)]">
          <section className="px-3 py-2 border-b border-border">
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <div className="text-muted-foreground">Window</div>
                <div>{(report.durationMs / 1000).toFixed(2)}s</div>
              </div>
              <div>
                <div className="text-muted-foreground">Renders</div>
                <div>{report.totalRenders.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Components</div>
                <div>{report.uniqueComponents}</div>
              </div>
            </div>
            {report.truncated && (
              <div className="mt-1 text-[10px] text-amber-500">
                buffer truncated (10k samples cap)
              </div>
            )}
          </section>

          <section className="px-3 py-2 border-b border-border">
            <div className="text-muted-foreground mb-1">By store</div>
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-normal">store</th>
                  <th className="text-right font-normal">comps</th>
                  <th className="text-right font-normal">renders</th>
                  <th className="text-right font-normal">avg ms</th>
                  <th className="text-right font-normal">p95 ms</th>
                </tr>
              </thead>
              <tbody>
                {report.byStore.map((s) => (
                  <tr key={s.store}>
                    <td>{s.store}</td>
                    <td className="text-right">{s.components}</td>
                    <td className="text-right">{s.renders}</td>
                    <td className="text-right">{fmt(s.avgMs)}</td>
                    <td className="text-right">{fmt(s.p95Ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="px-3 py-2">
            <div className="text-muted-foreground mb-1">Top components</div>
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-normal">id</th>
                  <th className="text-left font-normal">store</th>
                  <th className="text-right font-normal">×</th>
                  <th className="text-right font-normal">avg</th>
                  <th className="text-right font-normal">p95</th>
                  <th className="text-right font-normal">max</th>
                </tr>
              </thead>
              <tbody>
                {report.byComponent.slice(0, 30).map((c) => (
                  <tr key={c.id}>
                    <td className="truncate max-w-[180px]" title={c.id}>{c.id}</td>
                    <td className="text-muted-foreground">{c.store}</td>
                    <td className="text-right">{c.renders}</td>
                    <td className="text-right">{fmt(c.avgMs)}</td>
                    <td className="text-right">{fmt(c.p95Ms)}</td>
                    <td className="text-right">{fmt(c.maxMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
