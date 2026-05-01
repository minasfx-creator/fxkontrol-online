import { ClaimBadge } from './ClaimBadge';
import { CheckCircle2, Circle, Wrench, Activity, ShieldCheck } from 'lucide-react';

interface Item {
  label: string;
  status: 'done' | 'in_progress' | 'todo';
  note?: string;
}

const BENCH_EVIDENCE: Item[] = [
  { label: 'XLR-inspired control language', status: 'done' },
  { label: 'Mobile operation harness', status: 'in_progress', note: 'iOS Safari + Capacitor pass' },
  { label: 'Modular peripherals (FXK16 USB/BLE)', status: 'done' },
  { label: 'Bench validation log (50 cycles)', status: 'in_progress' },
  { label: 'Companion telemetry stream', status: 'todo', note: 'Day 36–60 milestone' },
  { label: 'Service flow + spare parts catalog', status: 'todo' },
  { label: 'US compliance review', status: 'todo' },
];

const ICONS = {
  done: CheckCircle2,
  in_progress: Activity,
  todo: Circle,
};
const COLORS = {
  done: 'text-green-500',
  in_progress: 'text-amber-500',
  todo: 'text-muted-foreground',
};

export function DockTwinPilotPanel() {
  const counts = BENCH_EVIDENCE.reduce(
    (acc, i) => ((acc[i.status]++, acc)),
    { done: 0, in_progress: 0, todo: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-background/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-semibold">DockTwin Pilot</h4>
          <ClaimBadge status="pilot" className="ml-auto" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Physical–digital twin inspired by XLR control language. Treated as a pilot product —
          not a broad commercial hardware line — until bench evidence, service flow,
          companion telemetry and compliance review are complete.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Done" value={counts.done} tone="ok" />
        <Stat label="In progress" value={counts.in_progress} tone="warn" />
        <Stat label="Todo" value={counts.todo} tone="info" />
      </div>

      <div>
        <h5 className="text-[10px] ds-mono uppercase tracking-wider text-muted-foreground mb-2">Bench evidence checklist</h5>
        <ul className="space-y-1.5">
          {BENCH_EVIDENCE.map((i) => {
            const Icon = ICONS[i.status];
            return (
              <li key={i.label} className="flex items-start gap-2 text-[11px]">
                <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${COLORS[i.status]}`} />
                <div className="flex-1">
                  <span className="text-foreground">{i.label}</span>
                  {i.note && <span className="text-muted-foreground"> · {i.note}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-md border border-border bg-background/30 p-3 flex items-start gap-2">
        <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
        <p className="text-[10px] text-muted-foreground">
          DockTwin claims must carry pilot disclaimer until checklist reaches 100% done.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' | 'info' }) {
  const cls = tone === 'ok' ? 'text-green-500' : tone === 'warn' ? 'text-amber-500' : 'text-muted-foreground';
  return (
    <div className="rounded-md border border-border bg-background/30 p-2 text-center">
      <p className={`text-2xl ds-mono font-bold ${cls}`}>{value}</p>
      <p className="text-[9px] ds-mono uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
