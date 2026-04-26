/**
 * TimelineHealthSettingsPopover — operator UI for tuning the watchdog.
 *
 * Lives in the timeline header next to the `TimelineHealthBadge` so the
 * operator can see, in one place, *what* the clock is doing and *how
 * sensitive* the watchdog is. Wraps `useTimelineHealthSettings` and
 * exposes three sliders bounded by `TIMELINE_HEALTH_BOUNDS`:
 *
 *   - Stall threshold     (250..5000 ms)
 *   - Recovery cooldown   (500..30000 ms)
 *   - Sample interval     (50..1000 ms)
 *
 * Changes take effect immediately because `useTimelineClockHealthCheck`
 * subscribes to the same store and re-arms its `setInterval` whenever any
 * of the three values change. A "Reset to defaults" button restores
 * `TIMELINE_HEALTH_DEFAULTS` (750 / 4000 / 200 ms).
 */
import { Settings2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Root as RealPopover,
  Trigger as RealPopoverTrigger,
  Portal as RealPopoverPortal,
  Content as RealPopoverContent,
} from '@radix-ui/react-popover';
import {
  useTimelineHealthSettings,
  TIMELINE_HEALTH_BOUNDS,
  TIMELINE_HEALTH_DEFAULTS,
} from '@/hooks/useTimelineHealthSettings';
import { cn } from '@/lib/utils';

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 2)} s` : `${ms} ms`;
}

interface RowProps {
  label: string;
  description: string;
  value: number;
  bounds: { min: number; max: number; step: number };
  onChange: (n: number) => void;
  isDefault: boolean;
}

function SettingRow({ label, description, value, bounds, onChange, isDefault }: RowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
        <span
          className={cn(
            'font-mono text-[11px] tabular-nums',
            isDefault ? 'text-muted-foreground' : 'text-accent',
          )}
        >
          {formatMs(value)}
        </span>
      </div>
      <Slider
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
      />
      <p className="text-[10px] leading-tight text-muted-foreground/80">{description}</p>
    </div>
  );
}

export function TimelineHealthSettingsPopover() {
  const settings = useTimelineHealthSettings();

  const isAllDefault =
    settings.stallThresholdMs === TIMELINE_HEALTH_DEFAULTS.stallThresholdMs &&
    settings.recoveryCooldownMs === TIMELINE_HEALTH_DEFAULTS.recoveryCooldownMs &&
    settings.sampleIntervalMs === TIMELINE_HEALTH_DEFAULTS.sampleIntervalMs;

  return (
    <RealPopover>
      <RealPopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-md text-muted-foreground hover:bg-muted/15 hover:text-foreground"
          title="Watchdog settings"
          aria-label="Open timeline watchdog settings"
        >
          <Settings2 className="h-3 w-3" />
        </Button>
      </RealPopoverTrigger>
      <RealPopoverPortal>
        <RealPopoverContent
          side="bottom"
          align="end"
          sideOffset={6}
          className="z-50 w-80 rounded-lg border border-border/40 bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-xl"
        >
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              Clock Watchdog
            </p>
            <p className="text-[10px] text-muted-foreground">
              Tune how aggressively stalls are detected and recovered.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={isAllDefault}
            onClick={() => settings.reset()}
            className="h-6 gap-1 px-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>
        <Separator className="mb-3" />
        <div className="space-y-4">
          <SettingRow
            label="Stall threshold"
            description="How long the clock must be frozen under Play before the watchdog declares a stall."
            value={settings.stallThresholdMs}
            bounds={TIMELINE_HEALTH_BOUNDS.stallThresholdMs}
            onChange={(v) => settings.set({ stallThresholdMs: v })}
            isDefault={settings.stallThresholdMs === TIMELINE_HEALTH_DEFAULTS.stallThresholdMs}
          />
          <SettingRow
            label="Recovery cooldown"
            description="Minimum gap between consecutive auto-recovery attempts. Prevents toast spam."
            value={settings.recoveryCooldownMs}
            bounds={TIMELINE_HEALTH_BOUNDS.recoveryCooldownMs}
            onChange={(v) => settings.set({ recoveryCooldownMs: v })}
            isDefault={settings.recoveryCooldownMs === TIMELINE_HEALTH_DEFAULTS.recoveryCooldownMs}
          />
          <SettingRow
            label="Sample interval"
            description="Watchdog polling rate. Lower = faster detection, slightly higher CPU."
            value={settings.sampleIntervalMs}
            bounds={TIMELINE_HEALTH_BOUNDS.sampleIntervalMs}
            onChange={(v) => settings.set({ sampleIntervalMs: v })}
            isDefault={settings.sampleIntervalMs === TIMELINE_HEALTH_DEFAULTS.sampleIntervalMs}
          />
        </div>
      </RealPopoverContent>
    </RealPopover>
  );
}
