import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SEED_ASSETS } from './AssetLibrary';
import { ClaimBadge } from './ClaimBadge';
import { buildDemoSessionReport, type DemoSessionInput } from '@/lib/strategyReport';
import { renderStrategyReportPDF, downloadPdf } from '@/lib/pdfRenderer';
import { Briefcase, FileDown, Plus, Trash2, ShieldOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Outcome = 'pending' | 'won' | 'lost' | 'nurture';
type Audience = 'enterprise' | 'producer' | 'operator' | 'investor';

interface DemoSessionRow extends DemoSessionInput {
  id: string;
  created_at: string;
}

const AUDIENCES: Audience[] = ['enterprise', 'producer', 'operator', 'investor'];
const OUTCOMES: Outcome[] = ['pending', 'won', 'lost', 'nurture'];

const OUTCOME_COLOR: Record<Outcome, string> = {
  pending: 'ds-status-sync',
  won: 'ds-status-ok',
  lost: 'text-destructive border-destructive/40 bg-destructive/10 px-2 py-0.5 rounded-md text-[10px] ds-mono uppercase',
  nurture: 'ds-status-warn',
};

export function DemoSessionsPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<DemoSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({
    prospect_company: '',
    prospect_audience: 'enterprise' as Audience,
    asset_ids: [] as string[],
    objections: '',
    next_step: '',
    outcome: 'pending' as Outcome,
    notes: '',
  });

  const isAuthed = !!user;

  const reload = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('demo_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      toast({ title: 'Could not load sessions', description: error.message, variant: 'destructive' });
    } else {
      setRows((data ?? []) as DemoSessionRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const submit = async () => {
    if (!user) return;
    if (!draft.prospect_company.trim()) {
      toast({ title: 'Prospect required', description: 'Add a company name.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('demo_sessions').insert({
      owner_id: user.id,
      prospect_company: draft.prospect_company.trim(),
      prospect_audience: draft.prospect_audience,
      asset_ids: draft.asset_ids,
      objections: draft.objections || null,
      next_step: draft.next_step || null,
      outcome: draft.outcome,
      notes: draft.notes || null,
    });
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    setDraft({ ...draft, prospect_company: '', asset_ids: [], objections: '', next_step: '', notes: '' });
    toast({ title: 'Demo session logged' });
    reload();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('demo_sessions').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      reload();
    }
  };

  const exportPdf = async (row: DemoSessionRow) => {
    const report = buildDemoSessionReport(row);
    const bytes = await renderStrategyReportPDF(report);
    downloadPdf(bytes, `fxk-strategy-${row.prospect_company.replace(/\s+/g, '-').toLowerCase()}-${new Date(row.created_at).toISOString().slice(0, 10)}.pdf`);
  };

  const toggleAsset = (id: string) => {
    setDraft((d) => ({
      ...d,
      asset_ids: d.asset_ids.includes(id) ? d.asset_ids.filter((x) => x !== id) : [...d.asset_ids, id],
    }));
  };

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({ ...acc, [r.outcome]: (acc[r.outcome as Outcome] ?? 0) + 1 }),
      { pending: 0, won: 0, lost: 0, nurture: 0 } as Record<Outcome, number>,
    );
  }, [rows]);

  if (!isAuthed) {
    return (
      <div className="rounded-md border border-border bg-background/30 p-6 text-center">
        <ShieldOff className="h-5 w-5 text-amber-500 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Sign in to log and review demo sessions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Counts */}
      <div className="grid grid-cols-4 gap-2">
        {OUTCOMES.map((o) => (
          <div key={o} className="rounded-md border border-border bg-background/30 p-2 text-center">
            <p className="text-2xl ds-mono font-bold text-foreground">{counts[o]}</p>
            <p className="text-[9px] ds-mono uppercase tracking-wider text-muted-foreground">{o}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="rounded-md border border-border bg-background/30 p-3 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Plus className="h-3.5 w-3.5 text-primary" />
          <h4 className="text-xs font-semibold">Log a new demo session</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            value={draft.prospect_company}
            onChange={(e) => setDraft({ ...draft, prospect_company: e.target.value })}
            placeholder="Prospect company *"
            className="bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs"
          />
          <select
            value={draft.prospect_audience}
            onChange={(e) => setDraft({ ...draft, prospect_audience: e.target.value as Audience })}
            className="bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs ds-mono uppercase tracking-wider"
          >
            {AUDIENCES.map((a) => <option key={a} value={a}>audience: {a}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[9px] ds-mono uppercase tracking-wider text-muted-foreground">Assets shown</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {SEED_ASSETS.map((a) => {
              const sel = draft.asset_ids.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAsset(a.id)}
                  className={`text-[10px] ds-mono px-2 py-1 rounded-md border transition-colors ${
                    sel ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border bg-background/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {a.title}
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          value={draft.objections}
          onChange={(e) => setDraft({ ...draft, objections: e.target.value })}
          placeholder="Objections raised…"
          rows={2}
          className="w-full bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs resize-none"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            value={draft.next_step}
            onChange={(e) => setDraft({ ...draft, next_step: e.target.value })}
            placeholder="Next step"
            className="bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs"
          />
          <select
            value={draft.outcome}
            onChange={(e) => setDraft({ ...draft, outcome: e.target.value as Outcome })}
            className="bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs ds-mono uppercase tracking-wider"
          >
            {OUTCOMES.map((o) => <option key={o} value={o}>outcome: {o}</option>)}
          </select>
        </div>

        <textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          placeholder="Notes"
          rows={2}
          className="w-full bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs resize-none"
        />

        <button
          onClick={submit}
          className="w-full rounded-md bg-primary/10 border border-primary/40 px-3 py-2 text-xs ds-mono uppercase tracking-wider text-primary hover:bg-primary/20"
        >
          Save session
        </button>
      </div>

      {/* List */}
      <div>
        <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 text-primary" />
          Recent sessions
          <span className="ml-auto text-[9px] ds-mono text-muted-foreground">{rows.length}</span>
        </h4>
        {loading ? (
          <p className="text-[11px] text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No sessions yet. Log your first demo above.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border border-border bg-background/30 p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h5 className="text-xs font-semibold text-foreground">{r.prospect_company}</h5>
                  <span className="text-[9px] ds-mono uppercase tracking-wider text-muted-foreground">{r.prospect_audience}</span>
                  <span className={`inline-flex items-center text-[10px] ds-mono uppercase tracking-wider ${r.outcome === 'lost' ? OUTCOME_COLOR.lost : OUTCOME_COLOR[r.outcome as Outcome]}`}>
                    {r.outcome === 'lost' ? r.outcome : <ClaimBadge status={r.outcome === 'won' ? 'validated' : r.outcome === 'pending' ? 'marketing_hypothesis' : 'pilot'} />}
                  </span>
                  <span className="ml-auto text-[9px] ds-mono text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.next_step && <p className="text-[11px] text-foreground mt-1">→ {r.next_step}</p>}
                {r.objections && <p className="text-[10px] text-muted-foreground mt-1">Objections: {r.objections}</p>}
                {r.asset_ids.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">Assets: {r.asset_ids.length}</p>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => exportPdf(r)}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] ds-mono uppercase tracking-wider text-primary hover:bg-primary/20"
                  >
                    <FileDown className="h-3 w-3" /> Strategy report
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] ds-mono uppercase tracking-wider text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
