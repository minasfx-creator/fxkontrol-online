/**
 * FXKNetPanel — Unified Art-Net Network + Module Control + DMX I/O + Pixel Mapping + Bézier Curves
 * BR2049 holographic aesthetics + network topology + firmware + signal quality
 */
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Globe, Cpu, ArrowLeftRight, Grid3X3, Spline } from 'lucide-react';
import ArtNetModulePanel from './ArtNetModulePanel';
import VirtualIFMx32QPanel from './VirtualIFMx32QPanel';
import DMXIOPanel from './DMXIOPanel';
import PixelMappingPanel from './PixelMappingPanel';
import DMXBezierEditor from '../DMXBezierEditor';

interface FXKNetPanelProps {
  fs?: boolean;
}

/* Simple network topology mini-map */
function TopologyMinimap({ moduleCount }: { moduleCount: number }) {
  const nodes = useMemo(() => {
    return Array.from({ length: Math.min(moduleCount || 4, 8) }, (_, i) => ({
      id: i,
      x: 20 + (i % 4) * 30,
      y: i < 4 ? 15 : 40,
      signal: 60 + Math.random() * 40,
      fw: `1.${3 + (i % 3)}.${i}`,
    }));
  }, [moduleCount]);

  return (
    <div className="shrink-0 px-3 py-2 border-b" style={{ borderColor: 'hsl(270 60% 50% / 0.08)', background: 'hsl(220 12% 4%)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[7px] font-mono font-bold tracking-[0.2em]" style={{ color: 'hsl(270 60% 55%)' }}>NETWORK TOPOLOGY</span>
        <div className="flex items-center gap-2">
          <span className="text-[6px] font-mono text-muted-foreground/25">{nodes.length} NODES</span>
        </div>
      </div>
      <div className="flex gap-3">
        <svg width="140" height="55" viewBox="0 0 140 55" className="shrink-0">
          <rect x="62" y="22" width="16" height="12" rx="2" fill="hsl(270 60% 50% / 0.2)" stroke="hsl(270 60% 50%)" strokeWidth="0.8" />
          <text x="70" y="30" textAnchor="middle" fill="hsl(270 60% 55%)" fontSize="5" fontFamily="monospace">HUB</text>
          {nodes.map(n => (
            <g key={n.id}>
              <line x1="70" y1="28" x2={n.x} y2={n.y} stroke="hsl(270 60% 50% / 0.2)" strokeWidth="0.5" strokeDasharray="2 1" />
              <circle cx={n.x} cy={n.y} r="4" fill="none" stroke={n.signal > 80 ? 'hsl(120 70% 42%)' : n.signal > 50 ? 'hsl(32 100% 50%)' : 'hsl(0 85% 48%)'} strokeWidth="0.8" />
              <circle cx={n.x} cy={n.y} r="1.5" fill={n.signal > 80 ? 'hsl(120 70% 42%)' : 'hsl(32 100% 50%)'} />
            </g>
          ))}
        </svg>
        <div className="flex-1 space-y-0.5 overflow-hidden">
          {nodes.slice(0, 4).map(n => (
            <div key={n.id} className="flex items-center gap-1.5">
              <span className="text-[6px] font-mono text-muted-foreground/30 w-6">M{n.id + 1}</span>
              <div className="flex gap-[1px]">
                {[1, 2, 3, 4, 5].map(b => (
                  <div key={b} className="w-[3px] rounded-sm" style={{
                    height: 2 + b * 1.5,
                    backgroundColor: (n.signal / 20) >= b ? 'hsl(270 60% 55%)' : 'hsl(220 10% 12%)',
                  }} />
                ))}
              </div>
              <span className="text-[5px] font-mono" style={{ color: 'hsl(270 40% 40%)' }}>v{n.fw}</span>
              <span className="text-[5px] font-mono" style={{ color: n.signal > 80 ? 'hsl(120 70% 45%)' : 'hsl(32 100% 50%)' }}>{Math.round(n.signal)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type TabKey = 'network' | 'module' | 'dmx-io' | 'pixel-map' | 'bezier';

export default function FXKNetPanel({ fs = false }: FXKNetPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('network');

  const tabs: { key: TabKey; label: string; icon: typeof Globe; sub: string }[] = [
    { key: 'network', label: 'NET', icon: Globe, sub: 'ART-NET' },
    { key: 'module', label: 'MOD', icon: Cpu, sub: 'FIELD' },
    { key: 'dmx-io', label: 'I/O', icon: ArrowLeftRight, sub: 'DMX' },
    { key: 'pixel-map', label: 'PXL', icon: Grid3X3, sub: 'MAP' },
    { key: 'bezier', label: 'CRV', icon: Spline, sub: 'BÉZIER' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab Header */}
      <div
        className="shrink-0 flex border-b"
        style={{ background: 'hsl(220 12% 5%)', borderColor: 'hsl(32 100% 50% / 0.1)' }}
      >
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 transition-all relative",
                "text-[8px] font-mono font-bold tracking-[0.15em] uppercase",
                isActive
                  ? "text-[hsl(32_100%_65%)]"
                  : "text-muted-foreground/40 hover:text-muted-foreground/60"
              )}
            >
              <tab.icon className={cn("w-3 h-3", isActive && "drop-shadow-[0_0_4px_hsl(32_100%_50%/0.5)]")} />
              <span>{tab.label}</span>
              {isActive && (
                <div
                  className="absolute bottom-0 left-[15%] right-[15%] h-[2px]"
                  style={{ background: 'linear-gradient(90deg, transparent, hsl(32 100% 50% / 0.6), transparent)' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Holographic scanline */}
      <div
        className="h-[1px] shrink-0"
        style={{ background: 'linear-gradient(90deg, transparent 10%, hsl(32 100% 50% / 0.08) 50%, transparent 90%)' }}
      />

      {/* Network topology minimap — only on network/module tabs */}
      {(activeTab === 'network' || activeTab === 'module') && <TopologyMinimap moduleCount={6} />}

      {/* Content */}
      <div className="flex-1 overflow-hidden animate-console-boot">
        {activeTab === 'network' && <ArtNetModulePanel fs={fs} />}
        {activeTab === 'module' && <VirtualIFMx32QPanel fs={fs} />}
        {activeTab === 'dmx-io' && <DMXIOPanel fs={fs} />}
        {activeTab === 'pixel-map' && <PixelMappingPanel fs={fs} />}
      </div>
    </div>
  );
}
