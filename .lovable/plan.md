

# Plan: Add Pyro FireOne XL4 Firing Mode to FX Commander

## Overview
Add a dedicated **"Pyro"** mode tab to the FX Commander that replicates the FireOne XL4+ firing system with full pyrotechnic controls, connected to the existing AutoFire timecode system for synchronized pyro firing.

## Changes

### 1. Edit `src/components/editor/live-firing/types.ts`
- Add `'pyro_fire'` to the `FXCMode` union type

### 2. Create `src/components/editor/live-firing/PyroFireOnePanel.tsx`
A dedicated XL4-style pyro firing panel inside FX Commander with these sub-modes:

**Module Grid (Main View):**
- 99 field module selector (1-99), showing connected/armed/battery status per module
- 32-igniter grid per module with continuity indicators (green = OK, red = open, gray = fired)
- Individual igniter fire buttons (require Master ARM + Deadman)
- Resistance readout per igniter (Ω display)

**Firing Modes (tabs within the panel):**
- **Manual**: Select module + igniter, press FIRE (one-shot)
- **Step**: Sequential stepping through a cue list (NEXT FIRE button advances)
- **Timecode**: Connects to the existing `AutoFirePanel` cue list — reads `AutoFireCue[]` with `device: 'pyro'`, runs timecode-synced firing via the existing timer/SMPTE system
- **Test**: Low-current continuity test mode (no fire)

**Safety Systems (XL4-faithful):**
- Master Key Switch (must be ON to arm)
- ARM ALL / DISARM ALL for modules
- Individual module ARM toggle
- Deadman interlock (required for all firing)
- Emergency Stop (calls parent `handlePanic`)
- Misfire detection (igniter resistance change after fire attempt)

**AutoFire Bridge:**
- Import button: pulls pyro cues from `AutoFirePanel` DEMO_CUES (filtered by `device: 'pyro'`)
- Shared timecode: reads `runTimeMs` from a shared ref or broadcast channel
- When timecode reaches a pyro cue, fires the corresponding module/igniter and broadcasts via `fxc-fire` for Mobile Link sync

**Hardware Integration:**
- Reuses `fireoneProtocol.ts` for real RS-485 communication
- SIM mode toggle for testing without hardware
- Module scan (discover connected field modules)

### 3. Edit `src/components/editor/LiveFiringPanel.tsx`
- Import `PyroFireOnePanel`
- Add `'pyro_fire'` to `SWIPE_MODES` array (after `manual_fire`)
- Add `{ key: 'pyro_fire', label: '🔥 Pyro' }` to mode tabs in `renderSceneModeBar`
- Add case in `renderModeContent`: render `<PyroFireOnePanel>` passing `fireChannel`, `channels`, `pyroArm`, `dmxArm`, `deadmanHeld`, `handlePanic`, `settings`, `artNetConnected`, `relayConnected`
- Pass `sendArtNetPacket` so pyro cues can trigger DMX output for e-matches with DMX igniters

### 4. Edit `src/components/editor/live-firing/AutoFirePanel.tsx`
- Export `DEMO_CUES` (currently const, make it importable)
- Add `onPyroCueExport` optional callback prop that passes the pyro-filtered cue list to the parent
- Add a "Send to Pyro Panel" button that broadcasts pyro cues via Supabase Realtime channel `fxc-pyro-sync`

## Files Summary

| File | Action |
|------|--------|
| `src/components/editor/live-firing/types.ts` | Edit — add `pyro_fire` to FXCMode |
| `src/components/editor/live-firing/PyroFireOnePanel.tsx` | Create — full XL4 pyro firing panel |
| `src/components/editor/live-firing/AutoFirePanel.tsx` | Edit — export DEMO_CUES, add pyro sync |
| `src/components/editor/LiveFiringPanel.tsx` | Edit — register Pyro mode tab + routing |

