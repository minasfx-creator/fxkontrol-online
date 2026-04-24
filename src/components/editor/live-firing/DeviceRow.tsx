/**
 * DeviceRow — Single channel row in the device table.
 * Pure presentational; selection + arm-state styling.
 */
import { cn } from '@/lib/utils';
import { SFX_TYPES } from './constants';
import type { SFXChannel } from './types';

interface DeviceRowProps {
  channel: SFXChannel;
  index: number;
  selected: boolean;
  onSelect: () => void;
  dmxArmed: boolean;
  fs: boolean;
}

export default function DeviceRow({
  channel, index, selected, onSelect, dmxArmed, fs,
}: DeviceRowProps) {
  const sfxType = SFX_TYPES.find(t => t.key === channel.type);
  const hasSafety = channel.safetyChannel !== undefined;

  return (
    <button onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-1 border-b border-border/10 transition-all text-left",
        fs ? "px-2.5 py-1.5 gap-2" : "px-1.5 py-1 gap-1",
        selected ? "bg-primary/15 border-primary/20" :
        dmxArmed && channel.enabled && hasSafety && channel.firing ? "bg-red-600/15" :
        dmxArmed && channel.enabled && hasSafety ? "bg-[hsl(210_80%_25%_/_0.2)]" :
        dmxArmed && channel.enabled ? "bg-[hsl(220_10%_12%)] hover:bg-[hsl(220_10%_15%)]" :
        "hover:bg-[hsl(220_10%_10%)]",
        !channel.enabled && "opacity-40"
      )}>
      <span className={cn("font-mono text-muted-foreground/40 text-right shrink-0", fs ? "text-[10px] w-4" : "text-[8px] w-3")}>{index + 1}</span>
      <div className={cn("rounded-sm shrink-0", fs ? "w-2 h-7" : "w-1.5 h-6")} style={{ backgroundColor: sfxType?.color || '#888' }} />
      <div className="flex-1 min-w-0">
        <div className={cn("font-bold uppercase truncate leading-tight", fs ? "text-[10px]" : "text-[10px]", selected ? "text-primary" : "text-foreground/80")}>
          {channel.name}
        </div>
        <div className={cn("font-mono text-muted-foreground/40 leading-tight", fs ? "text-[10px]" : "text-[10px]")}>
          {sfxType?.label} · U{channel.dmxUniverse}.{String(channel.dmxAddress).padStart(3, '0')}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        {channel.temperature !== undefined && (
          <span className={cn("font-mono", fs ? "text-[10px]" : "text-[10px]", channel.temperature > 600 ? "text-red-400" : "text-green-400/70")}>
            {channel.temperature}°
          </span>
        )}
        {channel.pressure !== undefined && (
          <span className={cn("font-mono text-cyan-400/70", fs ? "text-[10px]" : "text-[10px]")}>{channel.pressure}bar</span>
        )}
      </div>
      {channel.firing && <div className={cn("rounded-full bg-red-500 animate-pulse shrink-0", fs ? "w-2.5 h-2.5" : "w-2 h-2")} />}
    </button>
  );
}
