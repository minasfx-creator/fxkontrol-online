/**
 * GpuSamplingDiagnosticsPanel — visualizes the most recent `sampleFieldUltra` run.
 *
 * Read-only telemetry. Mode badge (GPU = primary/cyan, CPU = warning/amber),
 * duration, candidate count, drone count, fallback reason. Updates live via
 * the `useLastSampleRun` subscription. No business logic — pure presentation.
 */
import { Cpu, Zap, Clock, Hash, Target, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLastSampleRun } from "@/modules/swarmgpt/gpu/diagnosticsStore";

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export function GpuSamplingDiagnosticsPanel() {
  const run = useLastSampleRun();

  return (
    <Card className="bg-background/40 border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold tracking-wide">
              Sampling Diagnostics
            </CardTitle>
            <CardDescription className="text-xs">
              Last <code className="font-mono">sampleFieldUltra</code> run
            </CardDescription>
          </div>
          {run ? (
            <Badge
              variant={run.mode === "gpu" ? "default" : "secondary"}
              className="font-mono text-[10px] uppercase tracking-wider gap-1"
            >
              {run.mode === "gpu" ? <Zap className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
              {run.mode}
            </Badge>
          ) : (
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              Idle
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!run ? (
          <p className="text-xs text-muted-foreground">
            No sampling run recorded yet. Trigger a field generation to populate metrics.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Metric
                icon={<Clock className="h-3 w-3" />}
                label="Duration"
                value={formatDuration(run.diagnostics.durationMs)}
              />
              <Metric
                icon={<Hash className="h-3 w-3" />}
                label="Candidates"
                value={formatCount(run.diagnostics.candidateCount)}
              />
              <Metric
                icon={<Target className="h-3 w-3" />}
                label="Drones"
                value={formatCount(run.droneCount)}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/30">
              <span>field: {run.fieldType}</span>
              <span>WebGPU: {run.diagnostics.webgpuAvailable ? "✓" : "✗"}</span>
            </div>

            {run.fallbackReason && (
              <div className="flex items-start gap-2 text-[11px] text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="leading-snug">
                  <span className="font-semibold">CPU fallback:</span> {run.fallbackReason}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-mono text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

export default GpuSamplingDiagnosticsPanel;
