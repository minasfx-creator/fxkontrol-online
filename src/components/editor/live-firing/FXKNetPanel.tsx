/**
 * FXKNetPanel — Unified Art-Net Network + Module Control
 * Fuses ArtNetModulePanel (network discovery) + VirtualIFMx32QPanel (field module)
 * BR2049 holographic aesthetics
 */
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Globe, Cpu } from 'lucide-react';
import ArtNetModulePanel from './ArtNetModulePanel';
import VirtualIFMx32QPanel from './VirtualIFMx32QPanel';

interface FXKNetPanelProps {
  fs?: boolean;
}

export default function FXKNetPanel({ fs = false }: FXKNetPanelProps) {
  const [activeTab, setActiveTab] = useState<'network' | 'module'>('network');

  return (
    <div className="flex flex-col h-full">
      {/* Tab Header — BR2049 */}
      <div
        className="shrink-0 flex border-b"
        style={{
          background: 'hsl(220 12% 5%)',
          borderColor: 'hsl(32 100% 50% / 0.1)',
        }}
      >
        {[
          { key: 'network' as const, label: 'NETWORK', icon: Globe, sub: 'ART-NET DISCOVERY' },
          { key: 'module' as const, label: 'MODULE', icon: Cpu, sub: 'FIELD CONTROL' },
        ].map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 transition-all relative",
                "text-[9px] font-mono font-bold tracking-[0.2em] uppercase",
                isActive
                  ? "text-[hsl(32_100%_65%)]"
                  : "text-muted-foreground/40 hover:text-muted-foreground/60"
              )}
            >
              <tab.icon className={cn("w-3.5 h-3.5", isActive && "drop-shadow-[0_0_4px_hsl(32_100%_50%/0.5)]")} />
              <span>{tab.label}</span>
              {isActive && (
                <div
                  className="absolute bottom-0 left-[15%] right-[15%] h-[2px]"
                  style={{
                    background: 'linear-gradient(90deg, transparent, hsl(32 100% 50% / 0.6), transparent)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Holographic scanline */}
      <div
        className="h-[1px] shrink-0"
        style={{
          background: 'linear-gradient(90deg, transparent 10%, hsl(32 100% 50% / 0.08) 50%, transparent 90%)',
        }}
      />

      {/* Content */}
      <div className="flex-1 overflow-hidden animate-console-boot">
        {activeTab === 'network' ? (
          <ArtNetModulePanel fs={fs} />
        ) : (
          <VirtualIFMx32QPanel fs={fs} />
        )}
      </div>
    </div>
  );
}
