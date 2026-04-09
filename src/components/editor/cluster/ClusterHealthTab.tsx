/**
 * ─── Cluster Health Tab ─────────────────────────────────────────────
 * Unified dashboard: global health score, subsystem cards,
 * incident timeline with filters.
 */

import { useState, useEffect, useCallback } from 'react';
import { Shield, Cpu, Wifi, Heart, AlertTriangle, CheckCircle2, XCircle, Clock, Filter, RefreshCw, Skull, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  clusterHealthService,
  type ClusterSnapshot,
  type Incident,
  type HealthLevel,
} from '@/core/cluster/ClusterHealthService';
import { autoRecoveryService, type RecoveryStatus, type RecoveryState } from '@/core/reliability/AutoRecoveryService';

// ── Helpers ──────────────────────────────────────────────────────────

function levelColor(level: HealthLevel) {
  switch (level) {
    case 'healthy': return 'text-green-400';
    case 'degraded': return 'text-yellow-400';
    case 'critical': return 'text-red-400';
    case 'offline': return 'text-muted-foreground';
  }
}

function levelBg(level: HealthLevel) {
  switch (level) {
    case 'healthy': return 'bg-green-500/20 border-green-500/30';
    case 'degraded': return 'bg-yellow-500/20 border-yellow-500/30';
    case 'critical': return 'bg-red-500/20 border-red-500/30';
    case 'offline': return 'bg-muted/20 border-border/30';
  }
}

const SUBSYSTEM_ICONS: Record<string, React.ReactNode> = {
  safety: <Shield className="w-3.5 h-3.5" />,
  performance: <Cpu className="w-3.5 h-3.5" />,
  network: <Wifi className="w-3.5 h-3.5" />,
};

function subsystemIcon(id: string) {
  return SUBSYSTEM_ICONS[id] ?? <Heart className="w-3.5 h-3.5" />;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Global Health Ring ───────────────────────────────────────────────

function HealthRing({ score, level }: { score: number; level: HealthLevel }) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor = level === 'healthy' ? '#4ade80' : level === 'degraded' ? '#facc15' : '#f87171';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="88" height="88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-border/30" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={strokeColor} strokeWidth="5"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-lg font-bold font-mono ${levelColor(level)}`}>{score}</span>
        <span className="text-[8px] text-muted-foreground uppercase">{level}</span>
      </div>
    </div>
  );
}

// ── Subsystem Card ───────────────────────────────────────────────────

function SubsystemCard({ health }: { health: ClusterSnapshot['subsystems'][0] }) {
  return (
    <div className={`p-2 rounded border ${levelBg(health.level)}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className={levelColor(health.level)}>{subsystemIcon(health.id)}</span>
          <span className="text-[10px] font-bold text-foreground">{health.label}</span>
        </div>
        <Badge className={`${levelBg(health.level)} ${levelColor(health.level)} text-[8px] h-4 font-mono`}>
          {health.score}%
        </Badge>
      </div>
      <Progress value={health.score} className="h-1 mb-1" />
      <p className="text-[9px] text-muted-foreground truncate">{health.details}</p>
      <div className="flex gap-2 mt-1 flex-wrap">
        {Object.entries(health.metrics).map(([k, v]) => (
          <span key={k} className="text-[8px] text-muted-foreground">
            <span className="text-foreground/60">{k}:</span> {v}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Incident Row ─────────────────────────────────────────────────────

function IncidentRow({ incident, onResolve }: { incident: Incident; onResolve: (id: string) => void }) {
  return (
    <div className={`flex items-start gap-2 p-1.5 rounded text-[10px] ${
      incident.resolved ? 'opacity-50' : ''
    } ${incident.severity === 'critical' ? 'bg-red-500/5' : 'bg-yellow-500/5'}`}>
      {incident.severity === 'critical'
        ? <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
        : <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={levelColor(incident.severity === 'critical' ? 'critical' : 'degraded')}>
            {subsystemIcon(incident.subsystem)}
          </span>
          <span className="font-mono text-foreground truncate">{incident.message}</span>
        </div>
        <span className="text-muted-foreground font-mono">{formatTime(incident.timestamp)}</span>
        {incident.resolved && incident.resolvedAt && (
          <span className="text-green-400 ml-2">✓ {formatTime(incident.resolvedAt)}</span>
        )}
      </div>
      {!incident.resolved && (
        <Button size="sm" variant="ghost" className="h-5 text-[8px] px-1.5 shrink-0"
          onClick={() => onResolve(incident.id)}>
          <CheckCircle2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

type IncidentFilter = string;

export default function ClusterHealthTab() {
  const [snapshot, setSnapshot] = useState<ClusterSnapshot>(clusterHealthService.getSnapshot());
  const [incidents, setIncidents] = useState<Incident[]>(clusterHealthService.getIncidents());
  const [filter, setFilter] = useState<IncidentFilter>('all');
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setSnapshot(clusterHealthService.getSnapshot());
      setIncidents(clusterHealthService.getIncidents());
    };
    const unsub = clusterHealthService.onStateChange(refresh);
    const poll = setInterval(refresh, 1000);
    return () => { unsub(); clearInterval(poll); };
  }, []);

  const handleResolve = useCallback((id: string) => {
    clusterHealthService.resolveIncident(id);
    setIncidents(clusterHealthService.getIncidents());
  }, []);

  const filteredIncidents = incidents.filter(i => {
    if (filter !== 'all' && i.subsystem !== filter) return false;
    if (!showResolved && i.resolved) return false;
    return true;
  });

  const filters: { value: IncidentFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...snapshot.subsystems.map(s => ({ value: s.id, label: s.label })),
  ];

  return (
    <div className="space-y-3">
      {/* Header + Global Score */}
      <div className="flex items-center gap-3">
        <HealthRing score={snapshot.globalScore} level={snapshot.globalLevel} />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Cluster Health
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 text-[10px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Uptime</span>
              <span className="font-mono text-foreground">{formatUptime(snapshot.uptime)}</span>
            </div>
            <div className="flex justify-between">
              <span>Incidents</span>
              <span className={`font-mono ${snapshot.activeIncidents > 0 ? 'text-yellow-400' : 'text-foreground'}`}>
                {snapshot.activeIncidents} active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subsystem Cards */}
      <div className="space-y-1.5">
        {snapshot.subsystems.map(sub => (
          <SubsystemCard key={sub.id} health={sub} />
        ))}
      </div>

      {/* Incident History */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
            <Clock className="w-3 h-3" /> INCIDENTS ({filteredIncidents.length})
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant={showResolved ? 'secondary' : 'ghost'}
              className="h-5 text-[8px] px-1.5"
              onClick={() => setShowResolved(!showResolved)}>
              {showResolved ? 'Hide Resolved' : 'Show All'}
            </Button>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-1">
          {filters.map(f => (
            <Button key={f.value} size="sm"
              variant={filter === f.value ? 'secondary' : 'ghost'}
              className="h-5 text-[8px] px-2"
              onClick={() => setFilter(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>

        <ScrollArea className="h-40">
          <div className="space-y-0.5">
            {filteredIncidents.length === 0 ? (
              <div className="text-center py-4 text-[10px] text-muted-foreground/40">
                No incidents recorded
              </div>
            ) : (
              filteredIncidents.map(inc => (
                <IncidentRow key={inc.id} incident={inc} onResolve={handleResolve} />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
