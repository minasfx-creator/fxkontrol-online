import { useEffect, useState } from 'react';
import { AlertOctagon, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getSkyCanvasDiagnostics,
  subscribeSkyCanvasDiagnostics,
  clearSkyCanvasDiagnostics,
  type SkyCanvasDiagnosticEntry,
} from '@/lib/skyCanvasDiagnostics';

/**
 * SkyCanvasDiagnosticsPanel — surfaces captured SkyCanvas exceptions
 * (stack + scene state snapshot) inside the editor debug area.
 */
export default function SkyCanvasDiagnosticsPanel() {
  const [entries, setEntries] = useState<SkyCanvasDiagnosticEntry[]>(() => getSkyCanvasDiagnostics());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeSkyCanvasDiagnostics(() => setEntries(getSkyCanvasDiagnostics()));
  }, []);

  return (
    <div
      className="absolute top-2 right-2 z-30 w-[320px] max-h-[60vh] flex flex-col rounded-md border backdrop-blur-md pointer-events-auto select-text"
      style={{
        background: 'hsla(220, 20%, 8%, 0.92)',
        borderColor: entries.length > 0 ? 'hsla(0, 80%, 55%, 0.6)' : 'hsla(220, 20%, 25%, 0.5)',
        fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
        fontSize: '10px',
        color: 'hsla(0, 0%, 85%, 0.9)',
      }}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <AlertOctagon
            className={cn('w-3 h-3', entries.length > 0 ? 'text-red-400' : 'text-muted-foreground')}
          />
          <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
            SkyCanvas Diagnostics
          </span>
          <span className="text-[8px] text-muted-foreground/60">({entries.length})</span>
        </div>
        {entries.length > 0 && (
          <button
            onClick={clearSkyCanvasDiagnostics}
            className="text-muted-foreground hover:text-foreground p-0.5"
            title="Clear diagnostics"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="overflow-y-auto flex-1">
        {entries.length === 0 ? (
          <div className="p-3 text-center text-muted-foreground/60 text-[10px]">
            &gt; No SkyCanvas exceptions captured.
          </div>
        ) : (
          entries.map((e) => {
            const open = expandedId === e.id;
            return (
              <div key={e.id} className="border-b border-border/30 last:border-b-0">
                <button
                  onClick={() => setExpandedId(open ? null : e.id)}
                  className="w-full flex items-start justify-between gap-2 px-2.5 py-1.5 hover:bg-surface-1/40 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-red-400 font-semibold truncate">{e.source}</span>
                      <span className="text-muted-foreground/50 text-[8px]">
                        {new Date(e.ts).toLocaleTimeString('pt-BR', { hour12: false })}
                      </span>
                    </div>
                    <div className="text-[10px] text-foreground/80 truncate">{e.message}</div>
                  </div>
                  {open ? <ChevronUp className="w-3 h-3 mt-0.5 shrink-0" /> : <ChevronDown className="w-3 h-3 mt-0.5 shrink-0" />}
                </button>
                {open && (
                  <div className="px-2.5 pb-2 space-y-1.5">
                    <Section title="Scene State">
                      <pre className="whitespace-pre-wrap break-words text-[9px] text-muted-foreground">
                        {JSON.stringify(e.state, null, 2)}
                      </pre>
                    </Section>
                    {e.stack && (
                      <Section title="Stack">
                        <pre className="whitespace-pre-wrap break-words text-[9px] text-muted-foreground max-h-40 overflow-y-auto">
                          {e.stack}
                        </pre>
                      </Section>
                    )}
                    {e.componentStack && (
                      <Section title="Component Stack">
                        <pre className="whitespace-pre-wrap break-words text-[9px] text-muted-foreground max-h-32 overflow-y-auto">
                          {e.componentStack}
                        </pre>
                      </Section>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border/30 bg-surface-0/40 p-1.5">
      <div className="text-[8px] font-bold uppercase tracking-wider text-primary/80 mb-1">{title}</div>
      {children}
    </div>
  );
}
