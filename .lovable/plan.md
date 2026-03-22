

# Console Logos, Landscape Fullscreen Mobile & Specialized Controllers

## Overview

Create inline SVG logos for each of the 7 consoles with BR2049 aesthetic identity, implement landscape-optimized fullscreen mobile layout, and add specialized characteristics per controller.

## 1. Console Logo Components — `src/components/editor/ConsoleLogos.tsx`

New file with 7 inline SVG logo components, each with unique visual DNA:

| Console | Logo Concept | Accent Color |
|---------|-------------|--------------|
| FXK-PYRO | Flame icon inside hexagonal reticle with crosshair marks | Red `hsl(0 85% 48%)` |
| FXK-DMX | Lightning bolt inside circular oscilloscope ring with waveform arc | Blue `hsl(200 80% 48%)` |
| FXK-LIGHT | Beam cone radiating from lens element, surrounded by fixture ring | Indigo `hsl(240 50% 52%)` |
| FXK-DRONE | Quadcopter silhouette inside radar sweep circle with cardinal marks | Teal `hsl(165 100% 42%)` |
| SHOW CTRL | 4-quadrant diamond with system dots, mission control star | Amber `hsl(32 100% 50%)` |
| MODULE | Circuit board traces connecting to central chip die | Violet `hsl(270 60% 50%)` |
| DMX MONITOR | Signal waveform inside terminal bracket frame `[ ~ ]` | Green `hsl(120 70% 42%)` |

Each logo: ~48×48 SVG, monochrome with accent glow, animatable (subtle pulse on active). BR2049 style — thin strokes, tactical precision, geometric.

## 2. Landscape Fullscreen Mobile — `src/pages/CommandCenter.tsx`

Detect landscape orientation via `window.matchMedia('(orientation: landscape)')` + mobile check.

**Landscape layout** (game-style HUD):
```text
┌─────────────────────────────────────────────────┐
│ [LOGO] FXK-PYRO    ● ARMED   12:34:56   [☰] │  ← 32px top bar
├────┬────────────────────────────────────────────┤
│    │                                            │
│ N  │         MAIN CONSOLE CONTENT               │
│ A  │         (full landscape width)              │
│ V  │                                            │
│    │                                            │
├────┴────────────────────────────────────────────┤
│  safe-area-bottom                               │
└─────────────────────────────────────────────────┘
```

- Left edge: vertical icon-only nav rail (7 icons stacked, 40px wide)
- Top: ultra-slim status bar with active console logo + label + mission clock + ARM status
- Content fills remaining space — no scroll wrappers, panels use `h-full`
- Bottom nav hidden in landscape (replaced by side rail)
- Use `screen.orientation.lock('landscape')` when entering Command Center on mobile (with fallback)

## 3. Specialized Console Characteristics

### FXK-PYRO — already enhanced (Module Scanner, Fire Confirmation, BR2049 header)

### FXK-DMX (`LiveFiringPanel.tsx` super_dmx mode)
- Add **FLAME HEIGHT gauge**: SVG flame with fill level (0-100%) mapped to active fader
- Add **CO2 PRESSURE indicator**: circular gauge showing simulated tank pressure
- Add **SPARK DURATION timer**: countdown display for active spark effects
- Landscape: fader bank fills full width, scene buttons along bottom edge

### FXK-LIGHT (`MA3ControlPanel.tsx`)
- Add **COLOR TEMPERATURE strip**: horizontal gradient bar (2700K warm → 6500K cool) showing active temperature
- Add **FIXTURE COUNT badge**: live count of patched fixtures
- Add **CUE STACK minimap**: vertical strip showing position in cue sequence
- Landscape: split view — faders left, cue list right

### FXK-DRONE (`DroneCommandPanel.tsx`)
- Add **ALTITUDE TAPE**: vertical altitude indicator (aviation-style) for fleet average
- Add **WIND VECTOR arrow**: compass rose with wind direction/speed overlay
- Add **FORMATION LOCK status**: visual lock indicator when swarm holds position
- Landscape: map/formation fills left 60%, telemetry right 40%

### SHOW CTRL (`ShowControlPanel.tsx`)
- Add **SHOW ELAPSED timer**: large mission clock format HH:MM:SS.ff
- Add **SYSTEM HEARTBEAT pulses**: real-time heartbeat dots per system (animate on data)
- Add **THREAT LEVEL bar**: aggregate risk level from all systems (green→amber→red)
- Landscape: 2×2 grid fills screen, event log as overlay drawer

### MODULE (`FXKNetPanel.tsx`)
- Add **FIRMWARE VERSION display**: per-module firmware tag
- Add **NETWORK TOPOLOGY minimap**: simple tree/star diagram of connected modules
- Add **SIGNAL QUALITY heatmap**: color-coded signal strength per module
- Landscape: network map left, module detail right

### DMX MONITOR (`DMXMonitorPanel.tsx`)
- Add **UNIVERSE BANDWIDTH meter**: percentage of channels active per universe
- Add **PROTOCOL MIX pie**: Art-Net vs sACN vs Internal distribution
- Add **CHANNEL CHANGE RATE**: packets-per-second counter with sparkline
- Landscape: channel grid fills width, waveform/stats along bottom strip

## 4. CSS Additions — `src/index.css`

- `.console-logo-glow`: animated glow pulse matching console accent
- `.landscape-nav-rail`: vertical navigation styling for landscape mode
- `.landscape-hud-bar`: ultra-slim top status bar
- Orientation media queries for landscape-specific layouts

## Files

1. `src/components/editor/ConsoleLogos.tsx` — New: 7 SVG logo components
2. `src/pages/CommandCenter.tsx` — Landscape detection + layout + logos in nav
3. `src/components/editor/LiveFiringPanel.tsx` — DMX specialized gauges
4. `src/components/editor/MA3ControlPanel.tsx` — Light specialized indicators
5. `src/components/editor/DroneCommandPanel.tsx` — Aviation-style instruments
6. `src/components/editor/ShowControlPanel.tsx` — Mission control enhancements
7. `src/components/editor/live-firing/FXKNetPanel.tsx` — Network topology
8. `src/components/editor/DMXMonitorPanel.tsx` — Protocol analytics
9. `src/index.css` — Landscape + logo animation classes

## Technical Notes
- All logos are inline SVG (no external assets, no image generation needed)
- Landscape detection uses CSS media query + JS matchMedia for layout switching
- No new dependencies
- No database changes
- Each console's specialized widgets use simulated data consistent with existing patterns

