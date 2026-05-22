/**
 * DMXBudgetPresetSelector
 * ───────────────────────────────────────────────────────────────────
 * Selectable timing-budget presets for the DMX validation harness.
 * Lets operators validate the live pipeline against `safe`,
 * `standard`, or `aggressive` targets without changing code.
 *
 * Presentation-only: writes through `dmxTimingHarness.applyBudgetPreset()`,
 * which resets the rolling window + baseline so regression detection
 * compares apples-to-apples against the new target.
 *
 * Uses semantic design tokens (bg-surface-*, text-foreground, primary).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  dmxTimingHarness,
  DMX_BUDGET_PRESETS,
  type DMXBudgetPresetId,
} from '@/core/dmx/timingHarness';
import { cn } from '@/lib/utils';

const PRESET_ORDER: DMXBudgetPresetId[] = ['safe', 'standard', 'aggressive'];

export default function DMXBudgetPresetSelector() {
  const [active, setActive] = useState<DMXBudgetPresetId | null>(
    () => dmxTimingHarness.getActivePreset()
  );

  // Keep state in sync if another surface (e.g. devtools) changes it.
  useEffect(() => {
    const id = setInterval(() => {
      const cur = dmxTimingHarness.getActivePreset();
      setActive(prev => (prev === cur ? prev : cur));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const onPick = useCallback((id: DMXBudgetPresetId) => {
    dmxTimingHarness.applyBudgetPreset(id);
    setActive(id);
  }, []);

  const current = active ? DMX_BUDGET_PRESETS[active] : null;

  return (
    <div className="space-y-1.5 rounded-sm border border-border/30 bg-surface-1/60 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-mono-code uppercase tracking-wider text-muted-foreground">
          TIMING BUDGET PRESET
        </span>
        <span className="text-[8px] font-mono-code text-muted-foreground/60">
          {current ? `${current.targetHz}Hz · total ${current.budgets.total}ms` : 'CUSTOM'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {PRESET_ORDER.map(id => {
          const p = DMX_BUDGET_PRESETS[id];
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              title={p.description}
              className={cn(
                'rounded-sm border px-1.5 py-1 text-left transition-colors',
                'focus:outline-none focus:ring-1 focus:ring-primary/40',
                isActive
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-border/30 bg-surface-2/40 text-muted-foreground hover:bg-surface-2/70 hover:text-foreground'
              )}
              aria-pressed={isActive}
            >
              <div className="text-[9px] font-mono-code font-bold uppercase tracking-wider leading-tight">
                {id}
              </div>
              <div className="text-[8px] font-mono-code leading-tight opacity-80">
                {p.targetHz}Hz · {p.budgets.total}ms
              </div>
            </button>
          );
        })}
      </div>

      {current && (
        <p className="text-[8px] font-mono-code text-muted-foreground/70 leading-snug">
          {current.description}
        </p>
      )}
    </div>
  );
}
