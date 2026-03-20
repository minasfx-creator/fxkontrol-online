

# Plan: Layout Presets + Post-Import Adjustment Controls

## Overview

Two features: (1) a layout preset selector (Arena/Stage/Festival) in the UE5 import dialog, and (2) per-category spacing/height sliders that appear after file parsing to fine-tune layout before importing.

## Changes

### 1. Layout Presets in `src/lib/fixtureAutoLayout.ts`

Add a `LayoutPreset` type (`'stage' | 'arena' | 'festival'`) and three preset config maps that override the default `CATEGORY_CONFIGS`:

- **Stage** (default): Current values -- linear front-facing stage with truss overhead
- **Arena**: 360-degree layout -- fixtures use wider arc angles (full circle for wash/led-bar), trusses at multiple Z depths surrounding a center point, SFX ring around perimeter
- **Festival**: Large-scale outdoor -- increased `spreadX` values (1.5x), drones pushed further back, higher truss heights, wider spacing

Update `computeFixtureLayout` signature to accept an optional `preset` parameter and optional per-category overrides (`spreadScale: number`, `heightOffset: number`):

```typescript
export type LayoutPreset = 'stage' | 'arena' | 'festival';

export interface LayoutOverrides {
  spreadScale?: number;   // multiplier on spreadX (default 1.0)
  heightOffset?: number;  // additive offset on y (default 0)
}

export function computeFixtureLayout(
  fixtures: LayoutableFixture[],
  preset?: LayoutPreset,
  categoryOverrides?: Record<string, LayoutOverrides>
): LayoutResult[]
```

### 2. UI Controls in `src/components/editor/UE5DMXPrevisImporter.tsx`

After file is parsed and stats are shown, add a collapsible "Layout Settings" section:

- **Preset selector**: 3 radio buttons or segmented control (Stage / Arena / Festival) with small icons
- **Per-category adjusters**: For each detected category in the parsed file, show a compact row with:
  - Category icon + name
  - "Spread" slider (0.5x to 3.0x, default 1.0x)
  - "Height" slider (-5m to +15m offset, default 0)
- Store these as local state: `layoutPreset` and `categoryOverrides`
- Pass them to `computeFixtureLayout()` in `handleImport`

The dialog max width increases slightly to `sm:max-w-2xl` to fit the layout controls alongside the fixture list.

### Files Modified

1. **`src/lib/fixtureAutoLayout.ts`** -- Add preset configs, accept preset + overrides params
2. **`src/components/editor/UE5DMXPrevisImporter.tsx`** -- Add preset radio group, per-category sliders, pass to layout engine

