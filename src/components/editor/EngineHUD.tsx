/**
 * ─── Engine HUD — Professional Status Overlay ───────────────────────
 * Renders real-time engine telemetry over the 3D viewport.
 * Uses design system tokens. Zero external deps beyond React.
 */

import { useState, useEffect, useCallback } from 'react';
import { fxkEngine } from '@/core/engine/fxkEngine';
import { clusterSync } from '@/core/sync/clusterSyncEngine';
import { environmentEngine, type EnvironmentState } from '@/core/environment/environmentEngine';
import { autoScaler } from '@/core/reliability/autoScaler';
import { eventBus } from '@/core/system/eventBus';

interface HUDData {
  engineState: string;
  uptime: number;
  wind: number;
  windDir: number;
  tide: number;
  tideDir: string;
  clusterRole: string;
  clusterConnected: boolean;
  qualityTier: string;
  recentEvents: string[];
}

function useEngineHUD(refreshMs = 500): HUDData {
  const [data, setData] = useState<HUDData>({
    engineState: 'stopped',
    uptime: 0,
    wind: 0,
    windDir: 0,
    tide: 0,
    tideDir: 'slack',
    clusterRole: 'standalone',
    clusterConnected: false,
    qualityTier: 'high',
    recentEvents: [],
  });

  useEffect(() => {
    const events: string[] = [];
    const unsub = eventBus.onPrefix('SYSTEM.*', (event) => {
      events.push(event);
      if (events.length > 8) events.shift();
    });

    const timer = setInterval(() => {
      const status = fxkEngine.getStatus();
      const env = environmentEngine.getState();
      const cluster = clusterSync.getState();
      const scaler = autoScaler.getState();

      setData({
        engineState: status.state,
        uptime: status.uptime,
        wind: env.windSpeed,
        windDir: env.windDirection,
        tide: env.tideLevel,
        tideDir: env.tideDirection,
        clusterRole: cluster.role,
        clusterConnected: cluster.connected,
        qualityTier: scaler.tier,
        recentEvents: [...events],
      });
    }, refreshMs);

    return () => {
      clearInterval(timer);
      unsub();
    };
  }, [refreshMs]);

  return data;
}

export function EngineHUD() {
  const hud = useEngineHUD();

  const stateColor = hud.engineState === 'running'
    ? 'text-green-400'
    : hud.engineState === 'degraded'
      ? 'text-yellow-400'
      : 'text-muted-foreground';

  return (
    <div className="absolute top-3 left-3 z-50 pointer-events-none select-none font-mono text-[11px] leading-tight">
      <div className="bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 space-y-1 min-w-[180px]">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border/30 pb-1 mb-1">
          <div className={`w-1.5 h-1.5 rounded-full ${hud.engineState === 'running' ? 'bg-green-400' : 'bg-yellow-400'}`} />
          <span className="text-foreground font-semibold tracking-wider text-xs">FXK ENGINE</span>
        </div>

        {/* State */}
        <Row label="State" value={hud.engineState.toUpperCase()} className={stateColor} />
        <Row label="Uptime" value={`${hud.uptime.toFixed(0)}s`} />
        <Row label="Quality" value={hud.qualityTier.toUpperCase()} />

        {/* Environment */}
        <div className="border-t border-border/30 pt-1 mt-1">
          <Row label="Wind" value={`${hud.wind.toFixed(1)} m/s @ ${hud.windDir.toFixed(0)}°`} />
          <Row label="Tide" value={`${hud.tide.toFixed(2)}m ${hud.tideDir}`} />
        </div>

        {/* Cluster */}
        <div className="border-t border-border/30 pt-1 mt-1">
          <Row
            label="Cluster"
            value={hud.clusterRole}
            className={hud.clusterConnected ? 'text-green-400' : 'text-muted-foreground'}
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, className = 'text-foreground' }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
}
