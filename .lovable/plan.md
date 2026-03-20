

# Plan: Integrate Mobile Link into FX Commander Console

## What
Add "Mobile Link" as a new mode tab inside the FX Commander (LiveFiringPanel), so from within the console you can control the desktop remotely. The FX Commander will both **send** (when on mobile) and **receive** (when on desktop) fire commands via the existing Supabase Realtime broadcast channel.

## Changes

### 1. Edit `src/components/editor/live-firing/types.ts`
- Add `'mobile_link'` to the `FXCMode` type union

### 2. Create `src/components/editor/live-firing/MobileLinkMode.tsx`
A compact mode panel that fits inside the FX Commander layout (not a standalone panel):

**Connection Section:**
- Art-Net test button (reuses existing `sendArtNetPacket` validation)
- Relay status indicator (reuses existing relay connection)
- Realtime broadcast status (green/red dot)

**Virtual Fixtures Grid:**
- Add fixture form (name, type, color, DMX universe/address)
- 2-column grid of fixture cards with large FIRE buttons
- Intensity slider per fixture
- Fixtures persist in localStorage

**Event Log (Master/Receiver):**
- When on desktop, shows incoming fire events from mobile devices
- Scrolling log with fixture name, type, color, timestamp
- Each received event auto-calls `fireChannel()` from the parent FX Commander — this triggers the **real** Art-Net output + 3D SFX, not just virtual effects

**Key difference from standalone MobileLinkPanel:** This version calls the FX Commander's own `fireChannel()` and `sendArtNetPacket()` to trigger real channels, bridging mobile taps to the full DMX pipeline.

### 3. Edit `src/components/editor/LiveFiringPanel.tsx`
- Import `MobileLinkMode`
- Add `'mobile_link'` to `SWIPE_MODES` array
- Add `{ key: 'mobile_link', label: 'Link' }` to the mode tabs in `renderSceneModeBar`
- Add `Cable` icon import
- Add case in `renderModeContent`: render `<MobileLinkMode>` passing `fireChannel`, `channels`, `artNetConnected`, `relayConnected` as props
- Subscribe to Realtime broadcast channel `mobile-link` at component level — when receiving a `fixture-fire` event, call `fireChannel(channelId)` if the channel exists in the FX Commander's device list, or call `useLiveSfxStore.fireEffect()` for virtual fixtures

### 4. Broadcast Protocol Enhancement
When the mobile FX Commander fires a CUE key or manual channel:
- Also broadcast via Realtime: `{ event: 'fxc-fire', payload: { channelId, type, color, intensity, duration } }`
- Desktop FX Commander listens and mirrors the fire locally
- This means ANY fire action in mobile FX Commander automatically replicates on desktop

## Files Summary

| File | Action |
|------|--------|
| `src/components/editor/live-firing/types.ts` | Edit — add `mobile_link` to FXCMode |
| `src/components/editor/live-firing/MobileLinkMode.tsx` | Create — compact link mode for FX Commander |
| `src/components/editor/LiveFiringPanel.tsx` | Edit — add Link tab, Realtime listener, broadcast on fire |

