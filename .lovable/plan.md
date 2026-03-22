

# FXK Platform — Refine & Add More Style Per Platform

## Current State

Each platform already has basic branding (color accents, headers, badges). But the styling is still shallow — same card shapes, same fader components, same grid layouts across all platforms. Each platform needs deeper visual character that operators recognize instantly in the dark.

## Changes

### 1. PyroFireOnePanel.tsx — Deepen XL4+ 2.0 Military Identity

- Add scanline overlay effect to the entire panel background (subtle horizontal lines, 2px spacing, 3% opacity)
- Master Key button: add CSS keyframe glow pulsing red when ON (`box-shadow` breathing animation), key icon rotation from 0° to 45° on toggle
- Output Group indicators (A/B/C/D): add warning-stripe pattern border when any module in group is armed (diagonal red/dark stripes)
- Igniter grid cells: add inner shadow and beveled edge effect (like physical membrane buttons), fired cells get a burn mark gradient (dark center radiating orange fade)
- Mode tabs: add embossed texture (double border technique — outer dark, inner highlight, like physical membrane overlay keys)
- Add a subtle red gradient vignette at edges of the panel (darker red corners, fading to transparent center)
- LCD counters (MOD, IG, FIRE): add LCD-style green-on-black font effect with subtle text-shadow glow, and a faint "digit shadow" background pattern
- Connection bar: add pulsing green dot animation for active RS-485 link with data activity sparkle

### 2. LiveFiringPanel.tsx — FXCommander 2.0 Console Identity

- DMX mode status bar: add horizontal gradient stripe below header (cyan glow bar, 2px height, animated shimmer left-to-right)
- CUE key grid: when in `super_dmx`, add effect-type color-coded section dividers — group keys by their assigned SFX type with a thin colored header bar above each group
- Scene tabs (S0-S3): style as illuminated console buttons — active scene gets bright underline glow + elevated shadow, inactive gets recessed inset look
- Simple DMX channel list: add alternating row tinting with very subtle cyan stripe on even rows
- ARM bar: platform-specific styling — DMX modes get cyan border glow when armed, Fire modes get red border glow
- PANIC button: add danger-stripe CSS pattern behind text (diagonal amber/black stripes) visible only when system is armed
- Add a thin "console rail" decorative element below mode tabs — horizontal line with small notch marks (like a physical mixing console's fader rail marking)

### 3. MA3ControlPanel.tsx — LIGHTDESK 2.0 Theater Console

- Executor faders: active faders (value > 0) get violet glow border (`border-indigo-500/40`), background tint (`bg-indigo-500/8`), and box-shadow (`0 0 12px hsl(240 50% 52% / 0.15)`)
- Add Grand Master fader: full-width separated fader after the 8-fader grid, with "GM" label, larger height (h-16), violet accent top stripe, maps to executor page 201
- Fader tracks: add gradient fill — bottom-to-top fill color changes from dark to indigo as value increases
- GO button: add theater-style pulsing glow when OSC is connected (violet pulse `animate-pulse-glow`)
- Cue list: active cue gets a bright violet left-border accent (4px solid indigo), next cue gets a subtle dimmed preview highlight
- Tab triggers: add theatrical curtain gradient — violet-to-transparent gradient on active tab background
- BLACKOUT button: add alternating amber/black diagonal stripe pattern (CSS repeating-linear-gradient) as background texture
- Connection port LEDs: add subtle pulse animation on connected ports

### 4. DroneCommandPanel.tsx — NEW: SWARM OPS 2.0 Mission Control

Create `src/components/editor/DroneCommandPanel.tsx`:

- Header: "FXK-DRONES · SWARM OPS 2.0" with teal accent stripe and mission timer
- Background: dark teal tint (`hsl(165 8% 5%)`) with HUD grid overlay (CSS grid pattern using repeating-linear-gradient, teal lines at 5% opacity)
- 4-quadrant grid layout using CSS grid `grid-cols-2 grid-rows-2`:
  1. FLEET STATUS: drone count, simulated battery bar (teal fill), GPS lock count, signal bars — reads `droneFormations` from `useProjectStore`
  2. FORMATION PREVIEW: SVG dots on dark canvas showing current formation positions as teal circles
  3. MISSION TIMELINE: horizontal list of formation names as teal cards with arrows between them
  4. TELEMETRY FEED: monospace scrolling text showing simulated altitude/speed/heading data
- Launch bar at bottom: pre-flight checklist indicators (GPS ✓, BATTERY ✓, GEOFENCE ✓, SAFETY ✓, CLEARANCE ✓) as inline badges, two-step ARM → LAUNCH button with state machine
- HUD corner brackets decorative elements (CSS borders on corners only)
- All text monospace, uppercase, teal accent throughout

### 5. SwarmGPTPanel.tsx — SWARM OPS Branding Refinement

- Add "SWARM OPS 2.0" header bar with teal accent stripe (matching DroneCommandPanel)
- Prompt textarea: teal border (`border-teal-500/30`), label "MISSION BRIEF" above
- Quick prompt cards: teal-tinted borders, aerospace-style labels (all-caps monospace)
- Generation progress: "COMPUTING TRAJECTORIES..." with teal spinner, trajectory path animation CSS
- Mini preview canvas: add teal-tinted grid background and coordinate axis markers

### 6. CommandCenter.tsx — Wire drone_ops + Platform Sidebar Tinting

- Add `'drone_ops'` to `CommandMode` type
- Add to `CONSOLE_ACCENTS`: `drone_ops: { color: 'hsl(165 100% 42%)', glow: 'hsl(165 100% 42% / 0.08)', label: 'FXK-DRONES', badge: 'bg-teal-500/15 text-teal-400 border-teal-500/20' }`
- Add to HARDWARE section in `MODE_SECTIONS`: `{ key: 'drone_ops', label: 'FXK-DRONES', icon: Layers }`
- Add `case 'drone_ops': return <DroneCommandPanel fs />` in `renderDirectPanel`
- Sidebar left border: when active mode is pyro → thin red left glow bar, dmx → cyan, ma3 → indigo, drone_ops → teal (CSS border-left with matching accent color + box-shadow glow)

### 7. VirtualControllerHub.tsx — Branded Card Groups

- Add `'drones'` group to types and `GROUP_META`: `{ label: 'FXK Drone Systems', color: 'text-teal-400' }`
- Add drone controller card: `{ id: 'fxk-swarm', name: 'FXK-SWARM', manufacturer: 'FXK', type: 'module', connectionTypes: ['wifi_direct', 'radio'], channels: 500, description: 'Swarm controller · 500 drones · GPS+RTK', panelMode: 'drone_ops', group: 'drones' }`
- Card borders by group: `fireone → border-red-500/20`, `showven → border-amber-500/20`, `drones → border-teal-500/20`, `infrastructure → border-border/15`
- Add platform subtitle per card (small text below name): "XL4+ 2.0", "SWARM OPS 2.0", etc.
- Group headers: add thin colored top-border accent matching group color

## Files

1. `src/components/editor/live-firing/PyroFireOnePanel.tsx` — military depth styling
2. `src/components/editor/LiveFiringPanel.tsx` — console identity depth
3. `src/components/editor/MA3ControlPanel.tsx` — theater fader glow + Grand Master
4. `src/components/editor/DroneCommandPanel.tsx` — **NEW** mission control
5. `src/components/editor/SwarmGPTPanel.tsx` — aerospace branding
6. `src/pages/CommandCenter.tsx` — drone_ops mode + sidebar tinting
7. `src/components/editor/VirtualControllerHub.tsx` — branded cards + drones group

## Technical Notes

- No new dependencies
- No database changes
- All touch targets 48px+ minimum
- All text `/50` minimum opacity for interactive elements
- DroneCommandPanel reads from existing `useProjectStore`

