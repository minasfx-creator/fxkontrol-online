import { useMemo, useState } from 'react';
import { MATURITY_MATRIX, MATURITY_META, type MaturityStatus } from '@/lib/productMaturity';
import { CheckCircle2, AlertTriangle, Layers, Beaker } from 'lucide-react';

const ICON: Record<MaturityStatus, React.ComponentType<{ className?: string }>> = {
  production: CheckCircle2,
  pilot: AlertTriangle,
  scaffold: Layers,
  research: Beaker,
};

const TONE: Record<MaturityStatus, string> = {
  production: 'border-green-500/40 bg-green-500/5 text-green-400',
  pilot: 'border-amber-500/40 bg-amber-500/5 text-amber-400',
  scaffold: 'border-cyan-500/40 bg-cyan-500/5 text-cyan-400',
  research: 'border-border bg-background/40 text-muted-foreground',
};

const ORDER: MaturityStatus[] = ['production', 'pilot', 'scaffold', 'research'];

export function MaturityMatrixPanel() {
  const [filter, setFilter] = useState<MaturityStatus | 'all'>('all');

  const counts = useMemo(() => {
    const c: Record<MaturityStatus, number> = { production: 0, pilot: 0, scaffold: 0, research: 0 };
    for (const m of MATURITY_MATRIX) c[m.status]++;
    return c;
  }, []);

  const filtered = filter === 'all' ? MATURITY_MATRIX : MATURITY_MATRIX.filter((m) => m.status === filter);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {ORDER.map((s) => {
          const meta = MATURITY_META[s];
          const Icon = ICON[s];
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(active ? 'all' : s)}
              className={`text-left rounded-md border p-3 transition-colors ${TONE[s]} ${
                active ? 'ring-1 ring-current' : 'opacity-90 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[9px] ds-mono uppercase tracking-wider">{meta.label}</span>
              </div>
              <p className="ds-mono text-2xl font-semibold mt-1">{counts[s]}</p>
              <p className="text-[10px] opacity-80 mt-0.5 line-clamp-2">{meta.description}</p>
            </button>
          );
        })}
      </div>

      {filter !== 'all' && (
        <button
          type="button"
          onClick={() => setFilter('all')}
          className="text-[10px] ds-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← clear filter
        </button>
      )}

      <div className="space-y-2">
        {filtered.map((m) => {
          const meta = MATURITY_META[m.status];
          const Icon = ICON[m.status];
          return (
            <div key={m.module} className="rounded-md border border-border bg-background/30 p-3">
              <div className="flex items-start gap-2">
                <div className={`rounded px-1.5 py-0.5 border ${TONE[m.status]} flex items-center gap-1`}>
                  <Icon className="h-3 w-3" />
                  <span className="text-[9px] ds-mono uppercase tracking-wider">{meta.label}</span>
                </div>
                <h4 className="text-xs font-semibold text-foreground">{m.module}</h4>
              </div>
              <dl className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 text-[11px]">
                <Field label="Proof" value={m.proof} />
                <Field label="Risks" value={m.risks} />
                <Field label="Next milestone" value={m.nextMilestone} />
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] ds-mono uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-foreground mt-0.5">{value}</dd>
    </div>
  );
}
