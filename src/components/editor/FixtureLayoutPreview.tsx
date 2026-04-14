/**
 * FixtureLayoutPreview — Visual preview of fixture layout from DMX import
 */
import React from 'react';

interface Fixture {
  id?: string;
  name: string;
  x?: number;
  y?: number;
  channel?: number;
  [key: string]: any;
}

interface Props {
  fixtures: Fixture[];
  layoutPreset?: string;
  categoryOverrides?: Record<string, any>;
  selected?: Set<string>;
  [key: string]: any;
}

export default function FixtureLayoutPreview({ fixtures, layoutPreset, categoryOverrides }: Props) {
  return (
    <div className="w-full h-48 relative rounded border border-border/20 bg-muted/10 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
        {fixtures.length} fixtures • {layoutPreset || 'auto'}
      </div>
      {fixtures.map((f, i) => (
        <div
          key={f.id || i}
          className="absolute w-2 h-2 rounded-full bg-primary/60"
          style={{
            left: `${((f.x + 50) / 100) * 100}%`,
            top: `${((f.y + 50) / 100) * 100}%`,
          }}
          title={f.name}
        />
      ))}
    </div>
  );
}
