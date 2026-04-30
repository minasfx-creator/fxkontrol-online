/**
 * DS SegmentTabs — operational segment switcher (PYRO/SFX/DRONES/LIGHT/DMX).
 * Default: cyan underline on active. Per-segment color override available.
 *
 * Controlled component — parent owns the active id.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type SegmentId = 'pyro' | 'sfx' | 'drones' | 'light' | 'dmx' | (string & {});

export interface SegmentItem {
  id: SegmentId;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional badge (count, warning glyph, etc). */
  badge?: React.ReactNode;
}

export interface DsSegmentTabsProps {
  items: SegmentItem[];
  activeId: SegmentId;
  onChange: (id: SegmentId) => void;
  /** When true, underline takes the segment color instead of cyan. */
  colorPerSegment?: boolean;
  className?: string;
}

const SEGMENT_BAR: Record<string, string> = {
  pyro:   'ds-segment-pyro-bar',
  sfx:    'ds-segment-sfx-bar',
  drones: 'ds-segment-drones-bar',
  light:  'ds-segment-light-bar',
  dmx:    'ds-segment-dmx-bar',
};

const SEGMENT_TEXT: Record<string, string> = {
  pyro:   'text-segment-pyro',
  sfx:    'text-segment-sfx',
  drones: 'text-segment-drones',
  light:  'text-segment-light',
  dmx:    'text-segment-dmx',
};

export function DsSegmentTabs({
  items,
  activeId,
  onChange,
  colorPerSegment = false,
  className,
}: DsSegmentTabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex h-ds-tabs items-end gap-ds-1 border-b border-ds-border-default bg-ds-surface-panel px-ds-2',
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === activeId;
        const bar = colorPerSegment
          ? SEGMENT_BAR[item.id] ?? 'ds-segment-active-bar'
          : 'ds-segment-active-bar';
        const iconColor = SEGMENT_TEXT[item.id];
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex items-center gap-ds-2 px-ds-3 py-ds-2 text-[12px] font-mono uppercase tracking-wider',
              'transition-colors ds-focus rounded-ds-sm',
              active
                ? cn('text-ds-text-primary', bar)
                : 'text-ds-text-secondary hover:text-ds-text-primary',
            )}
          >
            {Icon && <Icon className={cn('size-3.5', iconColor)} />}
            <span>{item.label}</span>
            {item.badge && <span className="ml-ds-1">{item.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
