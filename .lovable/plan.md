

# Plan: Auto-Link SFX Positions to FX Commander + Art-Net Connection Test

## Summary

When adding SFX equipment (via Showven Equipment Panel or directly), the system will:
1. Automatically create an SFX channel in the FX Commander console linked to the position
2. Run an Art-Net connection test and show the result as a toast notification

## Current State

- **ShowvenEquipmentPanel** creates a `pyro` position + timeline item on double-click/drag, but does NOT create an FX Commander channel
- **LiveFiringPanel** manages its own `channels` state (local `useState`), disconnected from positions
- **Art-Net test** exists in DMXPanel but not triggered automatically
- `SFXChannel` type already has a `positionId` field, but it's never set automatically

## Problem

The FX Commander channels and scene positions are completely disconnected. Adding equipment in one panel doesn't register in the other.

## Implementation

### Step 1: Create a shared SFX Channel Store
**New file**: `src/store/useSfxChannelStore.ts`

A Zustand store to hold SFX channels globally (replacing LiveFiringPanel's local state), with actions:
- `addChannelFromPosition(position, equipmentPreset)` — creates an SFX channel linked to a position, auto-patches DMX address
- `removeChannel(id)`
- `testArtNetConnection()` — sends a validate request to `artnet-bridge` edge function, returns status
- `getChannels()`, `updateChannel()`, `setFiring()`, etc.

### Step 2: Auto-link on SFX Position Creation
**File**: `src/components/editor/ShowvenEquipmentPanel.tsx`

In `handleDoubleClick` (and drag-drop handler), after creating the position + timeline item:
- Call `useSfxChannelStore.getState().addChannelFromPosition(...)` to create a linked FX Commander channel
- Call `useSfxChannelStore.getState().testArtNetConnection()` which sends a validate packet to `artnet-bridge`
- Show toast with result: "✅ Art-Net OK — SPARKULAR L1 linked at DMX 1.001" or "⚠️ Art-Net offline — device added locally"

### Step 3: Integrate Store into LiveFiringPanel
**File**: `src/components/editor/LiveFiringPanel.tsx`

- Replace local `useState<SFXChannel[]>` with `useSfxChannelStore`
- Keep all firing logic (ARM, CUE, PANIC) working with the shared store
- New channels added from equipment panel appear immediately in the FX Commander device list

### Step 4: Art-Net Connection Test Function
**In the new store**: `testArtNetConnection()` sends a minimal validate request:

```typescript
const { data, error } = await supabase.functions.invoke('artnet-bridge', {
  body: { action: 'validate', universes: [{ universe: 0, subnet: 0, net: 0, channels: [0], sequence: 0 }] }
});
```

Returns `{ connected: boolean, latencyMs: number }` — displayed in toast on equipment add.

## Files to Create/Modify

| File | Change |
|---|---|
| `src/store/useSfxChannelStore.ts` | **New** — shared SFX channel store with auto-link + Art-Net test |
| `src/components/editor/ShowvenEquipmentPanel.tsx` | Call store on equipment add, trigger Art-Net test |
| `src/components/editor/LiveFiringPanel.tsx` | Use shared store instead of local state |

## User-Facing Behavior

1. User double-clicks a Sparkular in the Equipment Panel
2. Position appears in 3D viewport (existing)
3. Timeline item created (existing)
4. **NEW**: FX Commander channel auto-created with correct DMX type, auto-patched address, linked to position
5. **NEW**: Art-Net connection test runs → toast shows "Art-Net OK" or "Art-Net offline"
6. Opening FX Commander shows the new device immediately in the device list

