/**
 * SafetyMetricsTab — Event counters, violation timeline, system health
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { safetyAuditTrail, type AuditEntry } from '@/core/safety/SafetyAuditTrail';
import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import { continuityCheckService } from '@/core/safety/ContinuityCheckService';
import { getMetricsSnapshot } from '@/lib/hardening/observability';
import Sparkline from '@/components/ui/Sparkline';
import { Shield, Zap, AlertTriangle, Activity, Heart, Radio } from 'lucide-react';

// ── Event counter config ─────────────────────────────────────
const COUNTER_EVENTS = [
  { key: 'ARM', label: 'ARM', color: 'hsl(var(--fxk-amber))' },
  { key: 'DISARM', label: 'DISARM', color: 'hsl(var(--fxk-green))' },
  { key: 'FIRE', label: 'FIRE', color: 'hsl(var(--fxk-amber))' },
  { key: 'E_STOP', label: 'E-STOP', color: 'hsl(var(--destructive))' },
  { key: 'VIOLATION', label: 'VIOLATION', color: 'hsl(var(--destructive))' },
  { key: 'CONTINUITY_CHECK', label: 'CONT.CHK', color: 'hsl(var(--fxk-cyan))' },
] as const;

// ── State color map ──────────────────────────────────────────
const STATE_COLORS: Record<string, string> = {
  IDLE: 'hsl(var(--muted-foreground))',
  LOCKED: 'hsl(var(--fxk-amber))',
  ARMED: 'hsl(var(--destructive))',
  FIRING: 'hsl(var(--destructive))',
  COOLDOWN: 'hsl(var(--fxk-amber))',
  SAFE: 'hsl(var(--fxk-green))',
};

// ── Violation timeline bucketizer ────────────────────────────
function bucketize(entries: readonly AuditEntry[], bucketMs = 30_000) {
  const now = Date.now();
  const violations: number[] = [];
  const estops: number[] = [];
  const bucketCount = 10; // last 5 minutes in 30s buckets

  for (let i = 0; i < bucketCount; i++) {
    violations.push(0);
    estops.push(0);
  }

  for (const e of entries) {
    const age = now - e.timestamp;
    const idx = bucketCount - 1 - Math.floor(age / bucketMs);
    if (idx < 0 || idx >= bucketCount) continue;
    if (e.event === 'VIOLATION') violations[idx]++;
    if (e.event === 'E_STOP') estops[idx]++;
  }

  return { violations, estops, bucketCount };
}

// ── Mini bar chart ───────────────────────────────────────────
function ViolationTimeline({ entries }: { entries: readonly AuditEntry[] }) {
  const { violations, estops, bucketCount } = useMemo(() => bucketize(entries), [entries]);
  const maxVal = Math.max(1, ...violations, ...estops);
  const w = 200;
  const h = 40;
  const barW = w / bucketCount - 2;

  return (
    <div className="space-y-1">
      <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
        Violations · Last 5 min (30s buckets)
      </p>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
        {Array.from({ length: bucketCount }).map((_, i) => {
          const x = i * (barW + 2) + 1;
          const vH = (violations[i] / maxVal) * (h - 4);
          const eH = (estops[i] / maxVal) * (h - 4);
          return (
            <g key={i}>
              <rect
                x={x}
                y={h - 2 - vH}
                width={barW / 2}
                height={vH}
                fill="hsl(var(--destructive))"
                opacity={0.8}
                rx={1}
              />
              <rect
                x={x + barW / 2}
                y={h - 2 - eH}
                width={barW / 2}
                height={eH}
                fill="hsl(var(--fxk-amber))"
                opacity={0.8}
                rx={1}
              />
            </g>
          );
        })}
        <line x1={0} y1={h - 1} x2={w} y2={h - 1} stroke="hsl(var(--border))" strokeWidth={0.5} />
      </svg>
      <div className="flex gap-3 text-[7px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-destructive inline-block" /> Violations
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm inline-block" style={{ background: 'hsl(var(--fxk-amber))' }} /> E-Stop
        </span>
      </div>
    </div>
  );
}

export default function SafetyMetricsTab() {
  const [entries, setEntries] = useState<readonly AuditEntry[]>([]);
  const [fpsHistory, setFpsHistory] = useState<number[]>([]);

  const refresh = useCallback(() => {
    setEntries(safetyAuditTrail.getAll());
    const m = getMetricsSnapshot();
    setFpsHistory(prev => {
      const next = [...prev, m.fps.avg];
      return next.length > 30 ? next.slice(-30) : next;
    });
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  // ── Counts ─────────────────────────────────────────────────
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of COUNTER_EVENTS) map[c.key] = 0;
    for (const e of entries) {
      if (map[e.event] !== undefined) map[e.event]++;
    }
    return map;
  }, [entries]);

  // ── Health snapshot ────────────────────────────────────────
  const metrics = getMetricsSnapshot();
  const contReport = continuityCheckService.getReport();
  const safetyState = safetyStateMachine.state;
  const conditions = safetyStateMachine.conditions;

  return (
    <div className="space-y-3 text-[10px]">
      {/* A. Event Counters */}
      <div>
        <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          Event Counters
        </p>
        <div className="grid grid-cols-3 gap-1">
          {COUNTER_EVENTS.map(({ key, label, color }) => (
            <div
              key={key}
              className="bg-surface-1 rounded px-2 py-1.5 flex items-center justify-between"
            >
              <span className="text-muted-foreground truncate">{label}</span>
              <span className="font-mono font-bold tabular-nums" style={{ color }}>
                {counts[key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* B. Violation Timeline */}
      <ViolationTimeline entries={entries} />

      {/* C. System Health */}
      <div>
        <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          System Health
        </p>
        <div className="space-y-1">
          {/* Safety State */}
          <div className="flex items-center justify-between bg-surface-1 rounded px-2 py-1">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Shield className="w-3 h-3" /> State
            </span>
            <span
              className="font-mono font-bold text-[9px] px-1.5 py-0.5 rounded"
              style={{
                color: STATE_COLORS[safetyState] || 'hsl(var(--foreground))',
                background: 'hsl(var(--surface-2))',
              }}
            >
              {safetyState}
            </span>
          </div>

          {/* Continuity */}
          <div className="flex items-center justify-between bg-surface-1 rounded px-2 py-1">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Zap className="w-3 h-3" /> Continuity
            </span>
            <span className="font-mono font-bold tabular-nums">
              <span style={{ color: contReport.short > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--fxk-green))' }}>
                {contReport.ok}/{contReport.total}
              </span>
              {contReport.short > 0 && (
                <span className="text-destructive ml-1">({contReport.short} SHORT)</span>
              )}
            </span>
          </div>

          {/* Link */}
          <div className="flex items-center justify-between bg-surface-1 rounded px-2 py-1">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Radio className="w-3 h-3" /> Link
            </span>
            <span
              className="font-mono font-bold text-[9px]"
              style={{ color: conditions.linkStable ? 'hsl(var(--fxk-green))' : 'hsl(var(--destructive))' }}
            >
              {conditions.linkStable ? 'STABLE' : 'UNSTABLE'}
            </span>
          </div>

          {/* FPS + Sparkline */}
          <div className="flex items-center justify-between bg-surface-1 rounded px-2 py-1">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Activity className="w-3 h-3" /> FPS
            </span>
            <span className="flex items-center gap-2">
              <Sparkline data={fpsHistory} width={60} height={14} />
              <span className="font-mono font-bold tabular-nums" style={{
                color: metrics.fps.avg >= 50 ? 'hsl(var(--fxk-green))' : metrics.fps.avg >= 30 ? 'hsl(var(--fxk-amber))' : 'hsl(var(--destructive))'
              }}>
                {metrics.fps.avg.toFixed(0)}
              </span>
            </span>
          </div>

          {/* Uptime */}
          <div className="flex items-center justify-between bg-surface-1 rounded px-2 py-1">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Heart className="w-3 h-3" /> Uptime
            </span>
            <span className="font-mono font-bold tabular-nums text-foreground">
              {formatUptime(metrics.sessionDurationSec)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}
