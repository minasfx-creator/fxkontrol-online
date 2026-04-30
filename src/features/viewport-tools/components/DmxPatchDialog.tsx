/**
 * DmxPatchDialog — Visual DMX patch + Conflict Checker (MVP 2).
 *
 * Two tabs:
 *   • Patch        — universe summaries, fixture list per universe
 *   • Conflicts    — issues from auditDmxPatch() with severity chips
 *
 * Read-only with respect to ShowPlan: this dialog never mutates dmxCues
 * directly. Patch edits go through FixtureAddressing (visual layout) and
 * any planned operations are recorded via the operation log by the caller.
 */
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertOctagon, Info, RefreshCw, Layers, ShieldCheck } from 'lucide-react';
import { auditDmxPatch, type DmxAuditReport, type DmxConflict } from '../dmx/dmxConflictChecker';
import { fixtureAddressing } from '@/core/protocols/FixtureAddressing';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'patch' | 'conflicts';

const SEV_STYLES: Record<DmxConflict['severity'], string> = {
  error: 'bg-red-500/15 text-red-300 border-red-500/40',
  warn: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  info: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
};

const SEV_ICON: Record<DmxConflict['severity'], JSX.Element> = {
  error: <AlertOctagon className="h-3 w-3" />,
  warn: <AlertTriangle className="h-3 w-3" />,
  info: <Info className="h-3 w-3" />,
};

export default function DmxPatchDialog({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('patch');
  const [report, setReport] = useState<DmxAuditReport | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!open) return;
    setReport(auditDmxPatch());
  }, [open, tick]);

  const fixturesByUniverse = useMemo(() => {
    const all = fixtureAddressing.getAll();
    const map = new Map<number, typeof all>();
    for (const f of all) {
      const list = map.get(f.universe) ?? [];
      list.push(f);
      map.set(f.universe, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.startChannel - b.startChannel);
    return map;
  }, [tick, open]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl bg-[#050810]/95 border-cyan-500/25">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-xs tracking-widest text-cyan-300">
            <Layers className="h-4 w-4" /> DMX PATCH / CONFLICT CHECKER
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-cyan-500/15 pb-2">
          <div className="flex gap-1">
            {(['patch', 'conflicts'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-1 text-[10px] font-mono uppercase tracking-widest rounded-md border transition-all',
                  tab === t
                    ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/50'
                    : 'text-muted-foreground border-transparent hover:text-cyan-300 hover:border-cyan-500/20',
                )}
              >
                {t === 'patch' ? 'Patch' : `Conflicts${report ? ` (${report.totals.errors + report.totals.warnings})` : ''}`}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={refresh}
            className="h-7 gap-1 text-[10px] font-mono text-cyan-300 hover:text-cyan-200"
          >
            <RefreshCw className="h-3 w-3" /> RESCAN
          </Button>
        </div>

        {/* Totals strip */}
        {report && (
          <div className="grid grid-cols-5 gap-2 text-[9px] font-mono">
            <Stat label="Cues" value={report.totals.cues} />
            <Stat label="Fixtures" value={report.totals.fixtures} />
            <Stat label="Universes" value={report.totals.universes} />
            <Stat label="Errors" value={report.totals.errors} tone={report.totals.errors > 0 ? 'red' : 'ok'} />
            <Stat label="Warnings" value={report.totals.warnings} tone={report.totals.warnings > 0 ? 'amber' : 'ok'} />
          </div>
        )}

        {/* Body */}
        <ScrollArea className="h-[420px] pr-2">
          {tab === 'patch' ? (
            <PatchView fixturesByUniverse={fixturesByUniverse} report={report} />
          ) : (
            <ConflictsView report={report} />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  tone?: 'neutral' | 'ok' | 'amber' | 'red';
}) {
  const toneCls =
    tone === 'red'
      ? 'text-red-300 border-red-500/30'
      : tone === 'amber'
        ? 'text-amber-300 border-amber-500/30'
        : tone === 'ok'
          ? 'text-emerald-300 border-emerald-500/20'
          : 'text-foreground/80 border-cyan-500/15';
  return (
    <div className={cn('rounded border bg-black/30 px-2 py-1', toneCls)}>
      <div className="text-[8px] uppercase tracking-widest text-muted-foreground/70">{label}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function PatchView({
  fixturesByUniverse,
  report,
}: {
  fixturesByUniverse: Map<number, ReturnType<typeof fixtureAddressing.getAll>>;
  report: DmxAuditReport | null;
}) {
  if (!report) return null;
  const allUniverses = new Set<number>([
    ...report.universes.map((u) => u.universe),
    ...Array.from(fixturesByUniverse.keys()),
  ]);
  if (allUniverses.size === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <ShieldCheck className="h-6 w-6 text-emerald-400/60" />
        <p className="text-[10px] font-mono uppercase tracking-widest">No DMX cues or fixtures patched.</p>
      </div>
    );
  }

  const sorted = Array.from(allUniverses).sort((a, b) => a - b);

  return (
    <div className="space-y-3">
      {sorted.map((u) => {
        const snap = report.universes.find((x) => x.universe === u);
        const fixtures = fixturesByUniverse.get(u) ?? [];
        const used = snap?.channelsUsed ?? 0;
        const pct = Math.min(100, (used / 512) * 100);
        return (
          <div key={u} className="rounded border border-cyan-500/15 bg-black/40 p-3">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="font-bold text-cyan-300">U{u}</span>
              <span className="text-muted-foreground">
                {used}/512 ch · {snap?.cueCount ?? 0} cues · {fixtures.length} fixtures
                {snap && snap.conflicts > 0 && (
                  <span className="ml-2 rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-red-300">
                    {snap.conflicts} ⚠
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/20">
              <div
                className={cn(
                  'h-full rounded-full',
                  snap && snap.conflicts > 0 ? 'bg-red-400/60' : 'bg-cyan-400/60',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            {fixtures.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {fixtures.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded bg-black/40 px-2 py-1 text-[9px] font-mono"
                  >
                    <span className="text-foreground/80">{f.label}</span>
                    <span className="text-muted-foreground">
                      ch {f.startChannel}–{f.startChannel + f.channelCount - 1}
                      <span className="ml-2 text-cyan-400/70">{f.fixtureType}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConflictsView({ report }: { report: DmxAuditReport | null }) {
  if (!report) return null;
  if (report.conflicts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-emerald-300/80">
        <ShieldCheck className="h-6 w-6" />
        <p className="text-[10px] font-mono uppercase tracking-widest">No conflicts detected.</p>
      </div>
    );
  }
  // Group by severity
  const sorted = [...report.conflicts].sort((a, b) => {
    const order = { error: 0, warn: 1, info: 2 } as const;
    return order[a.severity] - order[b.severity];
  });
  return (
    <div className="space-y-1.5">
      {sorted.map((c, i) => (
        <div
          key={i}
          className={cn(
            'flex items-start gap-2 rounded border px-2 py-1.5 text-[9px] font-mono',
            SEV_STYLES[c.severity],
          )}
        >
          <span className="mt-0.5">{SEV_ICON[c.severity]}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[8px] uppercase tracking-widest opacity-80">{c.code}</span>
              <span className="opacity-60">·</span>
              <span className="opacity-80">U{c.universe} ch{c.channel}</span>
            </div>
            <div className="mt-0.5 text-foreground/85">{c.message}</div>
            {(c.cueIds?.length || c.fixtureIds?.length) && (
              <div className="mt-0.5 text-[8px] opacity-50">
                {c.fixtureIds?.length ? `fix:${c.fixtureIds.join(',')} ` : ''}
                {c.cueIds?.length ? `cue:${c.cueIds.join(',')}` : ''}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
