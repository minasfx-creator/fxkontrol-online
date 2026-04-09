/**
 * NetworkHealthTab — RTT timeline, transport grid, connection status
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Wifi, WifiOff, Activity, AlertTriangle, Signal, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  networkHealthService,
  type RTTSample,
  type TransportHealthInfo,
  type NetworkAlert,
  type ReconnectState,
} from '@/core/network/NetworkHealthService';
import { cn } from '@/lib/utils';

// ─── RTT Timeline (SVG) ─────────────────────────────────────────────

function RTTTimeline({ samples, width = 600, height = 100 }: { samples: RTTSample[]; width?: number; height?: number }) {
  if (samples.length < 2) {
    return (
      <div className="flex items-center justify-center h-20 text-[9px] text-muted-foreground/40">
        Collecting RTT data…
      </div>
    );
  }

  const maxRTT = Math.max(150, ...samples.map(s => s.rttMs));
  const budgetY = height - (100 / maxRTT) * (height - 4) - 2;

  const points = samples.map((s, i) => {
    const x = (i / (samples.length - 1)) * width;
    const y = height - (s.rttMs / maxRTT) * (height - 4) - 2;
    return { x, y, rtt: s.rttMs };
  });

  const pathD = `M${points.map(p => `${p.x},${p.y}`).join(' L')}`;

  // Gradient segments
  const segments: Array<{ d: string; color: string }> = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const avgRtt = (p1.rtt + p2.rtt) / 2;
    const color = avgRtt < 50
      ? 'hsl(var(--fxk-green, 142 71% 45%))'
      : avgRtt < 100
        ? 'hsl(var(--fxk-amber, 38 92% 50%))'
        : 'hsl(var(--fxk-red, 0 84% 60%))';
    segments.push({ d: `M${p1.x},${p1.y} L${p2.x},${p2.y}`, color });
  }

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ filter: 'drop-shadow(0 0 2px hsl(var(--fxk-cyan, 190 95% 39%) / 0.3))' }}
    >
      {/* Budget line at 100ms */}
      <line
        x1={0} y1={budgetY} x2={width} y2={budgetY}
        stroke="hsl(var(--fxk-red, 0 84% 60%))"
        strokeWidth="0.5"
        strokeDasharray="4,3"
        opacity={0.6}
      />
      <text x={width - 2} y={budgetY - 3} fontSize="7" fill="hsl(var(--fxk-red, 0 84% 60%))" textAnchor="end" opacity={0.6}>
        100ms
      </text>

      {/* Color-coded line segments */}
      {segments.map((seg, i) => (
        <path key={i} d={seg.d} fill="none" stroke={seg.color} strokeWidth="1.2" strokeLinecap="round" />
      ))}

      {/* Glow overlay */}
      <path d={pathD} fill="none" stroke="hsl(var(--fxk-cyan, 190 95% 39%))" strokeWidth="0.4" opacity={0.3} />
    </svg>
  );
}

// ─── Transport Card ──────────────────────────────────────────────────

function TransportCard({ info }: { info: TransportHealthInfo }) {
  const labels: Record<string, string> = { wifi: 'Wi-Fi', rs485: 'RS-485', relay: 'Relay' };

  return (
    <Card className={cn(
      'border transition-all duration-300',
      info.isActive
        ? 'border-[hsl(var(--fxk-cyan,190_95%_39%))]/40 bg-[hsl(var(--fxk-cyan,190_95%_39%))]/5'
        : 'border-border/20 bg-card/30',
      !info.alive && 'opacity-50'
    )}>
      <CardContent className="p-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold">{labels[info.id] || info.id}</span>
          <Badge
            variant={info.alive ? 'default' : 'destructive'}
            className="text-[7px] h-4 px-1"
          >
            {info.alive ? 'ALIVE' : 'DOWN'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-1 text-[8px] text-muted-foreground/60">
          <div>
            <span className="block text-muted-foreground/40">RTT</span>
            <span className={cn(
              'font-mono font-bold',
              info.rttMs < 50 ? 'text-green-400' : info.rttMs < 100 ? 'text-amber-400' : 'text-red-400'
            )}>
              {info.rttMs}ms
            </span>
          </div>
          <div>
            <span className="block text-muted-foreground/40">Loss</span>
            <span className="font-mono font-bold">{info.packetLoss.toFixed(1)}%</span>
          </div>
        </div>

        {info.isActive && (
          <div className="flex items-center gap-1 mt-1">
            <Signal className="w-3 h-3 text-[hsl(var(--fxk-cyan,190_95%_39%))]" />
            <span className="text-[7px] text-[hsl(var(--fxk-cyan,190_95%_39%))] font-bold">ACTIVE</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Alert Card ──────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: NetworkAlert }) {
  const age = Math.round((Date.now() - alert.timestamp) / 1000);
  return (
    <div className={cn(
      'flex items-center gap-2 px-2 py-1 rounded border text-[9px]',
      alert.severity === 'critical'
        ? 'border-red-500/30 bg-red-500/5 text-red-400'
        : 'border-amber-500/30 bg-amber-500/5 text-amber-400'
    )}>
      <AlertTriangle className="w-3 h-3 shrink-0" />
      <span className="flex-1 font-mono">{alert.message}</span>
      <span className="text-muted-foreground/40">{age}s ago</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function NetworkHealthTab() {
  const [, setTick] = useState(0);

  useEffect(() => {
    networkHealthService.start();
    const unsub = networkHealthService.onChange(() => setTick(t => t + 1));
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const rttHistory = networkHealthService.getRTTHistory();
  const currentRTT = networkHealthService.getCurrentRTT();
  const percentiles = networkHealthService.getRTTPercentiles();
  const packetLoss = networkHealthService.getPacketLossPercent();
  const transports = networkHealthService.getTransportHealth();
  const alerts = networkHealthService.getActiveAlerts();
  const reconnect = networkHealthService.getReconnectState();
  const uptime = networkHealthService.getUptimePercent();
  const totalSent = networkHealthService.getTotalMessagesSent();

  return (
    <div className="space-y-3">
      {/* Section A: RTT Timeline */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-muted-foreground/70 tracking-wider uppercase">
            RTT Timeline
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[7px] h-4 px-1 font-mono">
              NOW: {currentRTT}ms
            </Badge>
            <Badge variant="outline" className="text-[7px] h-4 px-1 font-mono">
              p50: {percentiles.p50}ms
            </Badge>
            <Badge variant="outline" className="text-[7px] h-4 px-1 font-mono">
              p95: {percentiles.p95}ms
            </Badge>
          </div>
        </div>
        <div className="rounded border border-border/20 bg-card/20 p-1">
          <RTTTimeline samples={rttHistory} height={80} />
        </div>
      </div>

      {/* Section B: Transport Status Grid */}
      <div>
        <span className="text-[10px] font-bold text-muted-foreground/70 tracking-wider uppercase block mb-1">
          Transport Status
        </span>
        <div className="grid grid-cols-3 gap-2">
          {transports.map(t => (
            <TransportCard key={t.id} info={t} />
          ))}
        </div>
      </div>

      {/* Section C: Connection Status */}
      <div>
        <span className="text-[10px] font-bold text-muted-foreground/70 tracking-wider uppercase block mb-1">
          Connection Status
        </span>
        <Card className="border-border/20 bg-card/30">
          <CardContent className="p-2 space-y-2">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <span className="block text-[7px] text-muted-foreground/40">Packet Loss</span>
                <span className={cn(
                  'text-[11px] font-mono font-bold',
                  packetLoss > 15 ? 'text-red-400' : packetLoss > 5 ? 'text-amber-400' : 'text-green-400'
                )}>
                  {packetLoss.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="block text-[7px] text-muted-foreground/40">Uptime</span>
                <span className="text-[11px] font-mono font-bold text-green-400">{uptime}%</span>
              </div>
              <div>
                <span className="block text-[7px] text-muted-foreground/40">Msgs Sent</span>
                <span className="text-[11px] font-mono font-bold">{totalSent}</span>
              </div>
              <div>
                <span className="block text-[7px] text-muted-foreground/40">Failovers</span>
                <span className="text-[11px] font-mono font-bold">{transports[0]?.failoverCount ?? 0}</span>
              </div>
            </div>

            {/* Reconnection status */}
            {reconnect.attempting && (
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-amber-500/5 border border-amber-500/20 text-[9px] text-amber-400">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span className="font-mono">
                  Reconnecting… attempt {reconnect.attempt}/{reconnect.maxAttempts} (next in {Math.round(reconnect.nextRetryMs / 1000)}s)
                </span>
              </div>
            )}

            {/* Active alerts */}
            {alerts.length > 0 && (
              <div className="space-y-1">
                {alerts.map(a => (
                  <AlertCard key={a.id} alert={a} />
                ))}
              </div>
            )}

            {alerts.length === 0 && !reconnect.attempting && (
              <div className="flex items-center gap-1 text-[9px] text-green-400/60">
                <Wifi className="w-3 h-3" />
                <span>All transports healthy</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
