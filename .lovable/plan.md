

# Plan: Mobile Link — Art-Net Test & Virtual Fixtures (Mobile → Desktop)

## Concept
A dedicated mobile panel where the operator can:
1. Test Art-Net connectivity (ping the edge function + relay)
2. Add **virtual fixtures** (par, wash, strobe, SFX) with DMX addressing
3. Tap buttons on the phone to **fire/trigger fixtures** — the effect is reflected on the desktop 3D viewport in real-time via shared Zustand stores and Supabase Realtime

The key insight: both mobile and desktop share the same Zustand stores (`useSfxChannelStore`, `useLiveSfxStore`, `useProjectStore`). When the user taps "FIRE" on mobile, it writes to `useLiveSfxStore.fireEffect()` which the desktop SkyCanvas already reads. For cross-device sync (phone ↔ computer on different browsers), we use a Supabase Realtime channel as a broadcast bridge.

```text
┌─ MOBILE ─────────────────────┐     ┌─ DESKTOP ────────────────┐
│ [Test Art-Net] → edge func   │     │                          │
│ [Test Relay]   → ws://9001   │     │   3D Viewport            │
│                              │     │   ┌──────────────┐       │
│ Virtual Fixtures:            │     │   │ PAR 1  🔴    │       │
│ ┌─────────┬─────────┐       │     │   │ WASH 2 🔵    │       │
│ │ PAR 1   │ WASH 2  │       │ ──→ │   │ STROBE 🟡   │       │
│ │ [FIRE]  │ [FIRE]  │       │     │   └──────────────┘       │
│ └─────────┴─────────┘       │     │                          │
│ ┌─────────┬─────────┐       │     │   DMX output via relay   │
│ │ STROBE  │ CO2 JET │       │     │                          │
│ │ [FIRE]  │ [FIRE]  │       │     │                          │
│ └─────────┴─────────┘       │     └──────────────────────────┘
│                              │
│ + Add Fixture                │
└──────────────────────────────┘
         ↕ Supabase Realtime broadcast channel
```

## Changes (5 files)

### 1. Create `src/components/editor/MobileLinkPanel.tsx`
The main panel with 3 sections:

**Connection Test Section:**
- "Test Art-Net" button → calls `supabase.functions.invoke('artnet-bridge', { body: { action: 'validate' } })` and shows latency + status
- "Test Relay" button → opens WebSocket to `ws://localhost:9001`, sends ping, shows pong result
- Status badges: green/red with latency in ms

**Virtual Fixtures Section:**
- List of virtual fixtures (name, type, DMX address, color swatch)
- "+ Add Fixture" button opens a mini-form: name, type (PAR/Wash/Strobe/Flame/CO2/Spark), color picker, DMX universe + address
- Each fixture gets a large **FIRE** button (red, 60px, haptic feedback)
- Tapping FIRE: calls `useLiveSfxStore.fireEffect()` locally + broadcasts via Supabase Realtime channel `mobile-link`
- Intensity slider per fixture (0-255)

**Broadcast Bridge:**
- On mount, subscribe to Supabase Realtime channel `mobile-link`
- When receiving a `fire` event from another device, call `useLiveSfxStore.fireEffect()` locally
- This enables mobile → desktop triggering across different browser sessions
- Also sends DMX data to Art-Net bridge edge function when a fixture fires

### 2. Edit `src/components/editor/PanelTabBar.tsx`
- Add `'mobilelink'` to `PanelId` type
- Add entry in Conexões section: `{ id: 'mobilelink', label: 'Mobile Link', icon: Cable }`

### 3. Edit `src/components/editor/MobileMoreMenu.tsx`
- Add `mobilelink` to the `🔌 Conexões` section

### 4. Edit `src/pages/Index.tsx`
- Import `MobileLinkPanel`
- Add render case: `{activePanel === 'mobilelink' && <MobileLinkPanel onClose={...} />}`

### 5. Edit `src/components/editor/MobileTabBar.tsx`
- Add a dedicated `Cable` icon tab in the dock for quick access to Mobile Link (replaces or adds alongside existing tabs)

## Realtime Broadcast Protocol
```typescript
// Send (mobile)
channel.send({
  type: 'broadcast',
  event: 'fixture-fire',
  payload: { fixtureId, type, color, intensity, duration, position }
});

// Receive (desktop)
channel.on('broadcast', { event: 'fixture-fire' }, (msg) => {
  useLiveSfxStore.getState().fireEffect(msg.payload);
});
```

No database tables needed — uses Supabase Realtime broadcast (ephemeral, no persistence).

## Key Design Decisions
- **No auth required for broadcast** — uses anonymous Realtime channels scoped by project
- **Haptic on every FIRE** — `navigator.vibrate(30)` for tactile confirmation
- **Glass style** — consistent with existing mobile HUD aesthetic
- **DMX output on fire** — when a fixture fires, also sends the DMX frame to Art-Net bridge for real hardware output
- **Virtual fixtures persist in localStorage** — survives page refresh on mobile

