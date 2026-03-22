

# Plan: Enhanced Glow Effect + FIR Export + Selection Flow Fixes

## Summary

Three deliverables: (1) more visible pulse/particle burst on positions when selected via timeline marquee, (2) FIR export with full module/slat/pin mapping from addressing store, (3) verify and fix bidirectional selection flow.

## Changes

### 1. `src/components/editor/PositionPins.tsx` — Enhanced Linked Glow with Particle Burst

Replace the subtle `LinkedGlowRing` with a more dramatic visual:
- Increase ring size (1.2→1.8 outer) and opacity (0.45→0.7)
- Add a second expanding ring that fades out (scale 1→3 over 2s, opacity 0.6→0) for a "shockwave" effect
- Add 8 small particle spheres orbiting the position (useFrame rotation) with additive blending
- Color: orange for pyro (#FF6B35), cyan for drone (#00B4D8)
- The effect activates when `hasLinkedGlow` is true (events selected from timeline)

### 2. `src/lib/fireoneScriptParser.ts` — Add `exportFireOneFIR()` Function

New export function that generates pipe-delimited `.fir` format:
- Format: `LaunchTimeMS|Slat|Cue|Description|ProductNumber|Size|Position|Event`
- Accept timeline items + addressing store data + positions as parameters
- Map each timeline item to its assigned module/slat/pin from the addressing store
- Include position name in the Position column
- Fall back to flat index calculation if no addressing entry exists
- Add to `autoDetectAndParse` awareness

### 3. `src/lib/fireoneScriptParser.ts` — Add `exportFireOneFIRFromProject()` Helper

Convenience function that pulls data from stores:
```typescript
export function exportFireOneFIRFromProject(): string
```
- Reads `useProjectStore` timeline items, positions, effects
- Reads `useAddressingStore` addresses
- Calls `exportFireOneFIR()` with mapped data
- Returns the complete .fir file string

### 4. `src/components/editor/Timeline.tsx` — Fix Marquee → Position Sync Timing

Current marquee `handleUp` calls `toggleTimelineItemSelection` then `selectMultiplePositionsAndLinkedEvents`. The toggle may interfere with the linked state. Fix:
- Collect all selected item IDs first
- Clear existing selection, then batch-set all selected items
- Then sync linked positions
- This ensures clean bidirectional state

### 5. `src/components/editor/PositionPins.tsx` — Also Show Glow When `isSelected` + Has Linked Items

Currently `hasLinkedGlow && !isSelected` hides the glow when position is directly selected. Change to show enhanced glow in both cases (selected positions with linked events get the particle burst too, just with the selection ring underneath).

## Files

| File | Change |
|------|--------|
| `src/components/editor/PositionPins.tsx` | Enhanced glow ring with particles, fix glow visibility |
| `src/lib/fireoneScriptParser.ts` | Add `exportFireOneFIR()` and `exportFireOneFIRFromProject()` |
| `src/components/editor/Timeline.tsx` | Fix marquee selection sync timing |

