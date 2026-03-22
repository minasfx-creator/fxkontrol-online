

# FXK Platform — Console Heritage Visual Identity

## Concept
"Remember the past, transmit the future" — each platform's UI draws visual DNA directly from the real hardware console that inspired it, then evolves it with modern digital aesthetics.

## 1. PyroFireOnePanel — FireOne XL4+ Heritage

The real XL4+ has: green LCD screen, membrane keypad with labeled function keys, LED status indicators, 4 output ports with individual LEDs, key switch, industrial gray/black housing.

**Visual changes:**
- **LCD Display Area**: Replace digital counters with a simulated green-on-black LCD panel (monospace font, `hsl(120 100% 45%)` on `hsl(120 5% 4%)`). Show MOD/IG/FIRE/STATUS in segmented-display style with subtle pixel grid texture behind text
- **Membrane Keypad Grid**: Mode tabs styled as physical membrane buttons — flat gray surface (`hsl(0 0% 18%`), slight emboss (double border: outer dark, inner light highlight), ALL-CAPS labels in the XL4+ style with thin white text on dark
- **4 Output Port LEDs**: Replace output group boxes with a row of 4 physical-looking circular LED indicators (glass dome effect with radial gradient, red/green states) labeled OUTPUT A-D
- **Key Switch**: Replace toggle with a circular key-switch graphic — CSS circle with a key slot line that rotates 45° on ARM, silver metallic gradient border
- **Panel Housing**: Add subtle brushed-metal texture header bar (horizontal linear gradient noise), rounded industrial corners, and a thin yellow "caution stripe" below the header (like physical panel labeling)
- **Status Bar**: Bottom bar styled like XL4+ front panel labels — embossed text on dark background, connection status as physical LEDs (red/green glass dots)

## 2. LiveFiringPanel — Showven FX Commander Heritage

The real FX Commander has: 10.1" touchscreen, scene buttons (S0-S3), CUE key matrix, fader controls, professional dark enclosure, cyan/blue UI theme.

**Visual changes:**
- **Scene Buttons (S0-S3)**: Style as backlit console buttons — active scene gets bright cyan underline glow + slightly raised shadow, inactive gets dark recessed look with thin border. Square shape with rounded corners matching physical button caps
- **CUE Key Matrix**: Each key styled as a physical illuminated button — slight 3D raise effect (gradient top-light to bottom-dark), rounded square shape, active keys glow with their effect-type color (fire=red, CO2=blue, sparks=amber)
- **Fader Bank (Simple DMX)**: Vertical fader tracks with physical groove look — dark inset channel with a lighter knob/cap indicator showing current position. Channel numbers in metal-embossed style below each fader
- **Console Housing Frame**: Add a thin dark bezel border around the entire panel (2px `hsl(200 5% 12%)`) with subtle corner radius, simulating the physical console enclosure
- **Touch Screen Header**: "FX COMMANDER 2.0" in the Showven style — clean sans-serif, cyan accent line, professional dark background
- **Mode Tabs**: Style as physical console function buttons (like the real FXC's top row) — flat dark buttons with thin top accent line in cyan when active

## 3. MA3ControlPanel — grandMA3 Heritage

The real grandMA3 has: vertical motorized faders with LCD scribble strips, encoder wheels, large GO button, command input, dark professional housing, blue/white UI theme on screens.

**Visual changes:**
- **Executor Faders**: Style fader bank to resemble grandMA3 physical faders — each fader gets a "scribble strip" label area below (dark box with label text), fader track as a physical groove (dark inset with lighter fill), active faders get the MA-style blue/white glow
- **Grand Master**: Larger, isolated fader with "GRAND MASTER" engraved-style text, physical metal-look border, separated by a visual divider line (like the real console's GM section)
- **GO Button**: Large, physical-looking button with the MA3's characteristic rounded rectangle shape, prominent drop shadow, pulsing blue glow when connected (like the real GO key backlight)
- **Command Line**: Style input as the MA3 command line — dark background, monospace font, blue cursor blink, "Cmd>" prompt prefix
- **Encoder Section**: Add visual encoder wheel indicators next to faders (circular CSS elements with tick marks) — decorative but reinforcing the grandMA3 identity
- **Console Frame**: Dark anthracite housing color (`hsl(220 5% 8%)`), with the MA3's characteristic silver/gray accent trim lines

## 4. DroneCommandPanel — DJI FlightHub / Military Drone HUD Heritage

Inspired by: DJI FlightHub 2 virtual cockpit, military drone GCS (Ground Control Station), NASA mission control.

**Visual changes:**
- **Primary Flight Display**: Replace simple SVG with a proper HUD-style artificial horizon overlay — compass rose ring around formation preview, altitude/speed tape indicators on sides
- **Telemetry Feed**: Style as military terminal — green phosphor text on black (`hsl(120 100% 45%)` on pure black), CRT scanline overlay, data lines prefixed with timestamps
- **Fleet Status**: Reorganize as a mission control "systems panel" — each subsystem (GPS, COMMS, BATTERY, THERMAL) gets its own status card with analog-style gauge indicators
- **Launch Bar**: Style as a physical missile/rocket launch console — flip-up safety cover visual (CSS transform reveal animation) over the LAUNCH button, red striped warning border
- **Mission Timeline**: Style as a flight plan strip — horizontal cards connected by flight path lines, active waypoint highlighted with beacon pulse
- **Map Grid**: Add coordinate grid labels (A1-J10 style) around formation preview, compass cardinal points (N/S/E/W), range rings

## 5. SwarmGPTPanel — Aerospace Mission Planning Heritage

- Add mission planning aesthetic — prompt area styled as "MISSION BRIEFING" terminal with green monospace text
- Quick prompts styled as aerospace mission cards with classification-level border styles
- Progress indicator as "TRAJECTORY COMPUTATION" with orbital path animation

## 6. CommandCenter — Platform-Aware Console Chrome

- Sidebar left border glows in platform color when mode is active
- Platform logo/icon in sidebar header area changes per active mode
- Add subtle "console power-on" transition when switching platforms (brief screen flash + fade-in)

## 7. VirtualControllerHub — Hardware Catalog Cards

- Each card gets a miniature product photo placeholder silhouette (CSS shape of the real hardware)
- Product generation badges: "GEN 1" for legacy references, "2.0" for current
- Connection type indicators as physical port icons (DB9 for RS-485, RJ45 for Ethernet, antenna for wireless)

## Files

1. `src/components/editor/live-firing/PyroFireOnePanel.tsx` — XL4+ LCD + membrane + key switch
2. `src/components/editor/LiveFiringPanel.tsx` — FX Commander console buttons + faders
3. `src/components/editor/MA3ControlPanel.tsx` — grandMA3 scribble strips + encoder wheels + GO key
4. `src/components/editor/DroneCommandPanel.tsx` — Military GCS HUD + flight displays
5. `src/components/editor/SwarmGPTPanel.tsx` — Aerospace mission planning terminal
6. `src/pages/CommandCenter.tsx` — Platform-aware console chrome
7. `src/components/editor/VirtualControllerHub.tsx` — Hardware catalog with product silhouettes

## Technical Notes

- No new dependencies — all CSS/Tailwind styling
- No database changes
- Console heritage effects use CSS only (gradients, shadows, borders, animations)
- All touch targets maintain 48px+ minimum
- All interactive text maintains `/50` minimum opacity
- LCD/CRT effects use `text-shadow` and `background-image` patterns
- Physical button effects use `box-shadow` inset/outset combinations

