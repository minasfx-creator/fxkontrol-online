/**
 * JOITruthInspector — Integration truth transparency panel
 * Lists all adapters with integration_mode, evidence_level, freshness
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Radio, Wifi, WifiOff } from 'lucide-react';
import { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';
import { getProvenanceBadge, type IntegrationMode } from '@/core/hardware/provenance';

interface DeviceTruth {
  id: string;
  label: string;
  mode: IntegrationMode;
  badge: string;
  badgeColor: string;
  online: boolean;
  evidenceLevel: string;
}

const MODE_HSL: Record<IntegrationMode, string> = {
  simulated: '210 90% 55%',
  replay: '38 90% 55%',
  live_read_only: '160 80% 45%',
  not_integrated: '0 70% 50%',
};

export function JOITruthInspector() {
  const [expanded, setExpanded] = useState(false);

  const devices = useMemo<DeviceTruth[]>(() => {
    return unifiedHardwareRegistry.getDevices().map(d => {
      const mode = (d.metadata?.integration_mode as IntegrationMode) || 'simulated';
      const badge = getProvenanceBadge(mode);
      return {
        id: d.id,
        label: d.label,
        mode,
        badge: badge.label,
        badgeColor: MODE_HSL[mode],
        online: d.connection_state === 'connected',
        evidenceLevel: (d.metadata?.evidence_level as string) || 'ui_only',
      };
    });
  }, []);

  const counts = useMemo(() => {
    const c = { simulated: 0, replay: 0, live_read_only: 0, not_integrated: 0 };
    devices.forEach(d => { if (d.mode in c) c[d.mode as keyof typeof c]++; });
    return c;
  }, [devices]);

  const Icon = expanded ? ChevronUp : ChevronDown;

  return (
    <div style={{ borderBottom: '1px solid hsl(190 100% 50% / 0.06)' }} className="shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[7px] font-mono tracking-wider uppercase hover:bg-white/[0.02] transition-colors"
        style={{ color: 'hsl(160 80% 50% / 0.6)' }}
      >
        <Radio className="h-2.5 w-2.5" />
        <span>TRUTH INSPECTOR</span>
        <div className="flex gap-1 ml-1">
          {counts.simulated > 0 && <span className="text-[6px] px-1 rounded" style={{ background: 'hsl(210 90% 55% / 0.12)', color: 'hsl(210 90% 60%)' }}>{counts.simulated} SIM</span>}
          {counts.live_read_only > 0 && <span className="text-[6px] px-1 rounded" style={{ background: 'hsl(160 80% 45% / 0.12)', color: 'hsl(160 80% 50%)' }}>{counts.live_read_only} LIVE</span>}
          {counts.replay > 0 && <span className="text-[6px] px-1 rounded" style={{ background: 'hsl(38 90% 55% / 0.12)', color: 'hsl(38 90% 60%)' }}>{counts.replay} RPL</span>}
          {counts.not_integrated > 0 && <span className="text-[6px] px-1 rounded" style={{ background: 'hsl(0 70% 50% / 0.12)', color: 'hsl(0 70% 60%)' }}>{counts.not_integrated} N/A</span>}
        </div>
        <Icon className="h-2.5 w-2.5 ml-auto" />
      </button>

      {expanded && (
        <div className="px-2 pb-1.5 space-y-0.5 max-h-40 overflow-y-auto animate-fade-in">
          {devices.map(d => (
            <div
              key={d.id}
              className="flex items-center gap-1.5 px-1.5 py-1 rounded text-[8px] font-mono"
              style={{ background: `hsl(${d.badgeColor} / 0.04)` }}
            >
              {d.online ? (
                <Wifi className="h-2.5 w-2.5 shrink-0" style={{ color: 'hsl(160 80% 50%)' }} />
              ) : (
                <WifiOff className="h-2.5 w-2.5 shrink-0" style={{ color: 'hsl(0 70% 50% / 0.5)' }} />
              )}
              <span className="flex-1 truncate" style={{ color: 'hsl(180 8% 75%)' }}>{d.label}</span>
              <span
                className="shrink-0 px-1 py-0.5 rounded text-[6px] tracking-wider font-bold"
                style={{ background: `hsl(${d.badgeColor} / 0.15)`, color: `hsl(${d.badgeColor})`, border: `1px solid hsl(${d.badgeColor} / 0.25)` }}
              >
                {d.badge}
              </span>
              <span className="shrink-0 text-[6px] tracking-wider uppercase" style={{ color: 'hsl(190 100% 50% / 0.35)' }}>
                {d.evidenceLevel.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
