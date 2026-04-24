/**
 * MobileModeTabs — Categorized mode switcher for mobile Live FX.
 * Pure presentational; receives current mode and change callback.
 */
import { useState } from 'react';
import { Activity, ChevronDown, Flame, Gauge, Globe, Radio, Signal, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FXCMode } from './types';

const MODE_CATEGORIES = [
  {
    label: 'EXECUTION', modes: [
      { key: 'super_dmx' as FXCMode, label: 'FXK-DMX', icon: Zap },
      { key: 'pyro_fire' as FXCMode, label: 'FXK-PYRO', icon: Flame },
    ],
  },
  {
    label: 'MONITORING', modes: [
      { key: 'show_control' as FXCMode, label: 'SHOW CTRL', icon: Activity },
      { key: 'dmx_monitor' as FXCMode, label: 'DMX MON', icon: Radio },
      { key: 'fxk_light' as FXCMode, label: 'FXK-LIGHT', icon: Gauge },
    ],
  },
  {
    label: 'HARDWARE', modes: [
      { key: 'module' as FXCMode, label: 'MODULE', icon: Globe },
      { key: 'ble_scan' as FXCMode, label: 'CONNECT', icon: Signal },
    ],
  },
];

interface MobileModeTabsProps {
  mode: FXCMode;
  onModeChange: (m: FXCMode) => void;
}

export default function MobileModeTabs({ mode, onModeChange }: MobileModeTabsProps) {
  const [expanded, setExpanded] = useState(true);
  const currentCategory = MODE_CATEGORIES.find(c => c.modes.some(m => m.key === mode));
  const currentMode = MODE_CATEGORIES.flatMap(c => c.modes).find(m => m.key === mode);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60"
        style={{ background: 'hsl(220 10% 7%)' }}
      >
        <ChevronDown className="w-3 h-3" />
        {currentCategory?.label} › {currentMode?.label}
      </button>
    );
  }

  return (
    <div className="px-2 py-2 space-y-2" style={{ background: 'hsl(220 10% 6%)' }}>
      {/* Quick access bar */}
      <div className="flex gap-1.5">
        {[
          { key: 'super_dmx' as FXCMode, label: 'DMX', icon: Zap },
          { key: 'pyro_fire' as FXCMode, label: 'Pyro', icon: Flame },
          { key: 'show_control' as FXCMode, label: 'Show', icon: Activity },
          { key: 'artnet_modules' as FXCMode, label: 'Module', icon: Globe },
        ].map(q => (
          <button
            key={q.key}
            onClick={() => { onModeChange(q.key); setExpanded(false); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg border-2 py-2.5 font-bold uppercase text-[9px] tracking-wider transition-all min-h-[44px]",
              mode === q.key
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/15 bg-[hsl(220_10%_10%)] text-muted-foreground/40"
            )}
          >
            <q.icon className="w-4 h-4" />
            {q.label}
          </button>
        ))}
      </div>
      {/* Categories grid */}
      {MODE_CATEGORIES.map(cat => (
        <div key={cat.label}>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30 mb-1 px-1">{cat.label}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {cat.modes.map(m => (
              <button
                key={m.key}
                onClick={() => { onModeChange(m.key); setExpanded(false); }}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-lg border py-3 transition-all min-h-[56px]",
                  mode === m.key
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/10 bg-[hsl(220_10%_9%)] text-muted-foreground/40 active:bg-[hsl(220_10%_14%)]"
                )}
              >
                <m.icon className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
