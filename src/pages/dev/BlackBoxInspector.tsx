/**
 * ─── /dev/blackbox-inspector ───────────────────────────────────────
 * Read-only forensic view over `safetyBlackBox` — the unified, hash-
 * chained audit log of every gate verdict (real-operation requests,
 * pyro dispatch verdicts, operator notes). NEVER writes; never arms.
 *
 * What you get:
 *   • Chain integrity check (verifyChain → ok | brokenAt)
 *   • Last 100 entries: seq, kind, ok/refused, reason, payload preview
 *   • Provenance/honesty chip per source class
 *   • Manual "record note" so operators can annotate field events
 *
 * Pure surface — uiCommandGateway / SafetyStateMachine are NOT touched.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  safetyBlackBox,
  recordSafetyNote,
  type SafetyBlackBoxEntry,
} from '@/core/safety/safetyBlackBox';
import { ProvenanceBadge } from '@/components/safety/ProvenanceBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString(); } catch { return iso; }
}

function shortHash(h: string) {
  if (!h || h === 'GENESIS') return h ?? '';
  return h.slice(0, 8) + '…' + h.slice(-6);
}

const KIND_TONE: Record<SafetyBlackBoxEntry['kind'], string> = {
  real_operation_request: 'ds-status-warn',
  pyro_dispatch_verdict:  'ds-status-fail',
  phase2_grant_link:      'ds-status-sync',
  note:                   'ds-status-ok',
};

export default function BlackBoxInspector() {
  const [entries, setEntries] = useState<SafetyBlackBoxEntry[]>([]);
  const [chain, setChain] = useState<{ ok: boolean; brokenAt?: number } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setEntries(safetyBlackBox.getRecent(100).slice().reverse());
    setChain(await safetyBlackBox.verifyChain());
  }, []);

  useEffect(() => { void refresh(); const id = setInterval(refresh, 3000); return () => clearInterval(id); }, [refresh]);

  const onAddNote = useCallback(async () => {
    const msg = note.trim();
    if (!msg) return;
    setBusy(true);
    try { await recordSafetyNote(msg, { surface: 'blackbox-inspector' }); setNote(''); await refresh(); }
    finally { setBusy(false); }
  }, [note, refresh]);

  const total = entries.length;
  const refused = entries.filter(e => !e.ok).length;

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-ds-h2 font-bold tracking-tight">Safety Black Box · Inspector</h1>
          <p className="text-ds-caption text-muted-foreground mt-1">
            Hash-chained audit log of every gate verdict. Read-only forensic surface.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProvenanceBadge mode="live_read_only" />
          <span className="ds-mono text-ds-caption text-muted-foreground">
            {total} entries · {refused} refused
          </span>
        </div>
      </header>

      {/* Chain status */}
      <section className={cn(
        'mb-4 rounded-md border px-4 py-3 ds-mono text-ds-label',
        chain?.ok ? 'ds-status-ok' : 'ds-status-fail',
      )}>
        {chain == null
          ? 'Verifying chain…'
          : chain.ok
            ? `CHAIN OK · ${total} link${total === 1 ? '' : 's'}`
            : `CHAIN BROKEN @ index ${chain.brokenAt}`}
      </section>

      {/* Manual note */}
      <section className="mb-6 flex gap-2">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Operator note (will be hash-chained)…"
          className="ds-mono"
          onKeyDown={(e) => { if (e.key === 'Enter') void onAddNote(); }}
        />
        <Button onClick={onAddNote} disabled={busy || !note.trim()} variant="secondary">
          Record note
        </Button>
      </section>

      {/* Entries */}
      <section className="rounded-md border border-border/40">
        <div className="grid grid-cols-[60px_90px_180px_70px_1fr_200px] gap-2 border-b border-border/40 bg-muted/20 px-3 py-2 ds-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>SEQ</span>
          <span>VERDICT</span>
          <span>KIND</span>
          <span>TIME</span>
          <span>PAYLOAD</span>
          <span>HASH</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/20">
          {total === 0 && (
            <div className="px-3 py-6 text-center text-ds-caption text-muted-foreground ds-mono">
              No entries recorded yet. Trigger a real-operation request or pyro dispatch verdict.
            </div>
          )}
          {entries.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[60px_90px_180px_70px_1fr_200px] gap-2 px-3 py-2 ds-mono text-[11px] hover:bg-muted/10"
            >
              <span className="text-muted-foreground">#{e.seq}</span>
              <span className={cn('inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px]', e.ok ? 'ds-status-ok' : 'ds-status-fail')}>
                {e.ok ? 'OK' : 'REFUSED'}
              </span>
              <span className={cn('inline-flex items-center justify-start rounded px-1.5 py-0.5 text-[10px] uppercase', KIND_TONE[e.kind])}>
                {e.kind.replace(/_/g, ' ')}
              </span>
              <span className="text-muted-foreground">{fmtTime(e.at)}</span>
              <span className="truncate text-foreground/80" title={JSON.stringify(e.payload)}>
                {e.reason ? <span className="text-[hsl(var(--status-fail))]">{e.reason} · </span> : null}
                {Object.entries(e.payload).slice(0, 3).map(([k, v]) => (
                  <span key={k} className="mr-2">
                    <span className="text-muted-foreground">{k}=</span>
                    <span>{typeof v === 'string' ? v : JSON.stringify(v)}</span>
                  </span>
                ))}
              </span>
              <span className="text-muted-foreground/70" title={e.entryHash}>
                ↳ {shortHash(e.entryHash)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-4 text-ds-caption text-muted-foreground ds-mono">
        Storage: localStorage <code>fxk.safety.blackbox.v1</code> · cap 500 · genesis-anchored SHA-256.
      </footer>
    </div>
  );
}
