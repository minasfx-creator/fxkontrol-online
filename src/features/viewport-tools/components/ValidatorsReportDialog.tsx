/**
 * ValidatorsReportDialog
 * ────────────────────────────────────────────────────────────
 * Unified report runner for advanced validators:
 *  - PYRO base validators (already in pyro plugin)
 *  - FireOne stagger validator
 *  - Showven device limits validator
 *  - DRONES proximity validator
 *
 * Pure read-only: it does not mutate the ShowPlan. Issues are derived from
 * the store on demand, sorted by severity, and grouped by code.
 */

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, RefreshCw, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import type { ValidationContext, ValidationIssue } from '../types';
import { fireoneValidators } from '../validators/fireone.validator';
import { showvenValidators } from '../validators/showven.validator';
import { pyroValidators } from '../validators/pyro.validator';
import { dronesValidators } from '../validators/drones.validator';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ValidatorRun {
  group: string;
  issues: ValidationIssue[];
}

function sevWeight(s: ValidationIssue['severity']): number {
  return s === 'error' ? 0 : s === 'warn' ? 1 : 2;
}

function SevIcon({ s }: { s: ValidationIssue['severity'] }) {
  if (s === 'error') return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
  if (s === 'warn') return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  return <Info className="h-3.5 w-3.5 text-cyan-300" />;
}

function runAll(): ValidatorRun[] {
  const positions = useProjectStore.getState().positions;
  const allIds = positions.map((p) => p.id);

  const ctxPyro: ValidationContext = {
    segment: 'PYRO',
    selectionIds: allIds,
    positions,
  };
  const ctxDrones: ValidationContext = {
    segment: 'DRONES',
    selectionIds: allIds,
    positions,
  };
  const ctxSfx: ValidationContext = {
    segment: 'SFX',
    selectionIds: allIds,
    positions,
  };

  const groups: ValidatorRun[] = [];
  const collect = (group: string, issues: ValidationIssue[]) => {
    if (issues.length) groups.push({ group, issues });
  };
  collect('PYRO base', pyroValidators.flatMap((v) => v(ctxPyro)));
  collect('FireOne stagger', fireoneValidators.flatMap((v) => v(ctxPyro)));
  collect(
    'Showven device limits',
    [
      ...showvenValidators.flatMap((v) => v(ctxPyro)),
      ...showvenValidators.flatMap((v) => v(ctxSfx)),
    ],
  );
  collect('DRONES proximity', dronesValidators.flatMap((v) => v(ctxDrones)));
  return groups;
}

export default function ValidatorsReportDialog({ open, onClose }: Props) {
  const [runs, setRuns] = useState<ValidatorRun[]>([]);

  const refresh = () => setRuns(runAll());

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const totals = useMemo(() => {
    let err = 0, warn = 0, info = 0;
    for (const g of runs) for (const i of g.issues) {
      if (i.severity === 'error') err++;
      else if (i.severity === 'warn') warn++;
      else info++;
    }
    return { err, warn, info, ok: err === 0 && warn === 0 };
  }, [runs]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-[#050810]/95 border-cyan-500/30 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cyan-200">
            {totals.ok ? (
              <ShieldCheck className="h-5 w-5 text-green-400" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-400" />
            )}
            Advanced Validators Report
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="border-red-500/40 text-red-300">
            {totals.err} errors
          </Badge>
          <Badge variant="outline" className="border-amber-500/40 text-amber-300">
            {totals.warn} warnings
          </Badge>
          <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
            {totals.info} info
          </Badge>
          <div className="ml-auto">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-cyan-300 hover:bg-cyan-500/10"
              onClick={refresh}
            >
              <RefreshCw className="h-3 w-3" /> Re-run
            </Button>
          </div>
        </div>

        <div className="mt-2 max-h-[60vh] overflow-y-auto space-y-3 pr-1">
          {totals.ok && (
            <div className="text-center py-8 text-green-400 text-sm flex flex-col items-center gap-2">
              <ShieldCheck className="h-8 w-8" />
              All advanced validators passed. SIMULATION = EXECUTION = REALITY ✓
            </div>
          )}
          {runs.map((g) => (
            <div
              key={g.group}
              className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-2"
            >
              <div className="text-[11px] font-semibold tracking-wider text-cyan-300 uppercase mb-1.5">
                {g.group} · {g.issues.length}
              </div>
              <ul className="space-y-1">
                {[...g.issues]
                  .sort((a, b) => sevWeight(a.severity) - sevWeight(b.severity))
                  .map((i, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs text-foreground/90"
                    >
                      <SevIcon s={i.severity} />
                      <div className="flex-1">
                        <span className="font-mono text-[10px] text-muted-foreground mr-1">
                          {i.code}
                        </span>
                        {i.message}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
