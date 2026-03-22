

# FXK Platform — 4 Product Line Controller Identities

## Summary

Give each of the 4 controller platforms a unique visual and operational identity. Two platforms need visual restyling (PYRO, DMX), two need new branded components (LIGHT, DRONES). Plus wire everything into CommandCenter with platform-aware chrome.

## Changes

### 1. PyroFireOnePanel.tsx — XL4+ 2.0 Identity (Restyle)

The panel already has strong functionality. Add visual branding:

- **Header**: Replace emoji "🔥 FXK-PYRO" with branded bar: `FXK-PYRO · XL4+ 2.0` in red accent stripe, LCD-style module/igniter/fired counters in bordered boxes
- **4 Output Groups**: Add A/B/C/D output group indicators above module selector — each group covers 8 modules (A=1-8, B=9-16, C=17-24, D=25-32) with individual LED status dots and group ARM toggles
- **Mode tabs**: Style as membrane-button look — sharp edges, slight inset shadow, uppercase monospace, matching real XL4+ membrane overlay aesthetic
- **Master Key**: Add key-switch rotation animation (CSS transform on toggle), larger touch target (64px width minimum)
- **Igniter grid cells**: Show resistance readout (Ω value) below igniter number, color-code: green ≤10Ω, amber 10-50Ω, red >50Ω/open
- **Background tint**: Deep red-tinted dark (`hsl(0 15% 5%)`)

### 2. LiveFiringPanel.tsx — DMX FXCommander 2.0 Identity (Restyle status bar + Simple DMX faders)

- **Status bar**: Context-aware branding based on active mode:
  - Fire modes → "FXK-PYRO · XL4+ 2.0" red accent
  - DMX modes → "FXK-DMX · FXCOMMANDER 2.0" cyan accent
- **Simple DMX mode content area**: Replace flat channel list with vertical fader bank UI:
  - 8 faders per bank, vertical sliders with channel number bottom, value top
  - Color indicator strip on each fader track matching device type color
  - Bank selector tabs (1-8, 9-16, 17-24, etc.)
- **Mode tab styling per platform**:
  - DMX modes: smooth rounded pills with subtle cyan glow
  - Fire modes: sharp-edged membrane buttons with red tint
- **CUE key grid in Super DMX**: Group CUE keys by effect type with colored section headers (flames=red, CO2=blue, sparks=amber, etc.)

### 3. MA3ControlPanel.tsx — LIGHTDESK 2.0 Identity (Restyle)

- **Header**: "FXK-LIGHT · LIGHTDESK 2.0" with indigo/violet accent stripe (`hsl(240 50% 52%)`)
- **Background tint**: Subtle violet dark (`hsl(240 12% 5%)`)
- **Connection indicators**: Restyle OSC/sACN/MVR badges as console port LEDs (round dots with label, green=linked, amber=standby, red=fault)
- **Executor faders section**: Restyle as proper console executor bank:
  - Each fader gets a backlit label strip effect (subtle glow behind label)
  - Active executor gets violet glow highlight
  - Grand Master fader visually separated with "GM" label and distinct border
- **Cue list GO/BACK/PAUSE buttons**: Enlarge to theater-style membrane keys (min-h-[48px], prominent GO button in violet, BACK in muted)
- **Blackout button**: Make full-width, prominent, styled as physical console BLACKOUT key (dark background, bright label, amber warning stripe)
- **Tab styling**: Violet-tinted tab triggers with curtain-inspired gradient

### 4. DroneCommandPanel.tsx — SWARM OPS 2.0 (New Component)

Create a new unified drone operations dashboard:

- **Header**: "FXK-DRONES · SWARM OPS 2.0" with teal accent (`hsl(165 100% 42%)`)
- **Background**: Dark with HUD grid overlay, teal tint (`hsl(165 8% 5%)`)
- **4-quadrant layout**:
  1. **FLEET STATUS** (top-left): Drone count from `useProjectStore`, battery aggregate bar, GPS lock indicator, signal strength
  2. **FORMATION PREVIEW** (top-right): Canvas/SVG showing current formation shape as dots, reads from `droneFormations`
  3. **MISSION TIMELINE** (bottom-left): Horizontal timeline of formation sequence with transition arrows
  4. **TELEMETRY FEED** (bottom-right): Scrolling readout of simulated altitude, speed, heading per drone
- **Launch Sequence bar** (bottom): Pre-flight checklist indicators (GPS ✓, BATTERY ✓, GEOFENCE ✓, SAFETY ✓, CLEARANCE ✓) + two-step "ARM SWARM" → "LAUNCH" button
- **Props**: `fs?: boolean`, reads from existing `useProjectStore` for formations/trajectory data

### 5. SwarmGPTPanel.tsx — SWARM OPS Branding (Minor restyle)

- Add "SWARM OPS 2.0" branding header with teal accent stripe
- Style prompt textarea with teal border and "MISSION BRIEF" label
- Quick prompt cards get teal-tinted borders and aerospace-style labels
- Generation progress text: "COMPUTING TRAJECTORIES..." with teal spinner

### 6. CommandCenter.tsx — Platform-Aware Sidebar & Drone Mode

- Add `drone_ops` as new `CommandMode` and wire to `DroneCommandPanel`
- Add to HARDWARE section in `MODE_SECTIONS` with teal accent
- Add to `CONSOLE_ACCENTS`: `drone_ops: { color: 'hsl(165 100% 42%)', label: 'FXK-DRONES', badge: teal }`
- Add to `renderDirectPanel`: `case 'drone_ops': return <DroneCommandPanel fs />`
- Platform-aware sidebar tint: when active mode is in fire group → red left border glow, dmx → cyan, ma3 → indigo, drone_ops → teal

### 7. VirtualControllerHub.tsx — Platform-Branded Cards

- Add FXK-DRONES group with teal card borders and drone icon
- FXK Fire Systems cards: red-tinted border `border-red-500/20`
- Showven cards: amber-tinted border `border-amber-500/20`
- Add "LIGHTDESK 2.0" subtitle to ma3 card, "SWARM OPS 2.0" to drone card
- Add drone controller card entry in CONTROLLERS array pointing to `drone_ops` panelMode

## Files

1. `src/components/editor/live-firing/PyroFireOnePanel.tsx` — XL4+ 2.0 visual identity
2. `src/components/editor/LiveFiringPanel.tsx` — FXCommander 2.0 branding + DMX fader bank
3. `src/components/editor/MA3ControlPanel.tsx` — LIGHTDESK 2.0 theater identity
4. `src/components/editor/DroneCommandPanel.tsx` — **NEW** SWARM OPS 2.0 mission control
5. `src/components/editor/SwarmGPTPanel.tsx` — SWARM OPS branding pass
6. `src/pages/CommandCenter.tsx` — drone_ops mode + platform-aware chrome
7. `src/components/editor/VirtualControllerHub.tsx` — branded card groups

## Technical Notes

- No new dependencies — all Tailwind + existing components
- No database changes
- DroneCommandPanel reads from existing `useProjectStore` (droneFormations, trajectories)
- All touch targets maintain 48px+ minimum
- All text maintains `/50` minimum opacity for dark-environment readability

