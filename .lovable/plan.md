

# Fix: Direction Lines Not Visible After Placing Effects

## Problem

The `DirectionLine` component exists in `PositionPins.tsx` (line 549-585) but renders at **0.15 opacity and only 2 units long** when not selected — essentially invisible against the dark scene background. The line doesn't consider whether the position has linked effects, so placing effects doesn't change its visibility.

## Changes

### `src/components/editor/PositionPins.tsx`

**1. Pass `hasEffects` to DirectionLine** (line 459):
- Add `hasEffects={linkedEffects > 0}` prop

**2. Update DirectionLine component** (lines 549-585):
- Accept `hasEffects: boolean` prop
- When `hasEffects` is true: opacity **0.5** (up from 0.15), length **4 units** (up from 2), lineWidth **2** — makes lines clearly visible immediately after placing effects
- When selected: opacity **0.85**, length **5 units**, lineWidth **3**
- When hovered: opacity **0.4**, length **3 units**
- Default (no effects, not selected): opacity **0.2**, length **2 units** — slightly more visible than before
- Use the position's type color (orange for pyro) instead of gray `#aaaaaa` when effects are linked
- Add a small glowing dot at the line origin (emissive sphere, 0.04 radius) when effects are present — acts as a "this position is armed" indicator

**3. Arrowhead size increase**: Scale cone from `[0.06, 0.18]` to `[0.08, 0.22]` for better visibility at distance.

| File | Change |
|------|--------|
| `src/components/editor/PositionPins.tsx` | Make direction lines prominent when effects are linked, increase base visibility |

