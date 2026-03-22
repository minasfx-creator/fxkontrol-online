

# Refine All Platform — Blade Runner 2049 Style

## Concept

Apply a unified Blade Runner 2049 visual identity across the entire platform: amber/orange holographic warmth, rain-streaked translucency, monospace terminal aesthetics, atmospheric depth. Every page and structural component gets the BR2049 treatment while preserving full functionality.

## Changes

### 1. `src/index.css` — Global BR2049 Palette Shift

- Shift primary accent from cyan (`165 100% 42%`) to amber (`32 100% 50%`)
- Add warm amber tint to `--ring`, `--sidebar-primary`, `--sidebar-ring`
- Keep destructive red and success green untouched (safety-critical)
- Add new CSS utilities:
  - `.br2049-rain` — subtle vertical rain-streak overlay (CSS pseudo-element, 2% opacity amber lines falling)
  - `.br2049-vignette` — radial amber vignette at edges
  - `.br2049-dust` — floating dust particles via CSS animation
  - `@keyframes rain-fall` — vertical line fall (8s loop)
  - `@keyframes dust-float` — horizontal drift (12s loop)
- Update existing `--gradient-brand` to amber→orange→warm-gold
- Update `.glass-hud`, `.glass-dock`, `.glass-sheet` borders to amber tint (`hsl(32 100% 50% / 0.06)`)
- Update scrollbar thumb to amber accent

### 2. `src/pages/Auth.tsx` — BR2049 Login Terminal

- Replace orb colors: cyan→amber, accent→warm orange, violet→deep amber
- Background grid: warmer tone (`hsl(32 100% 50% / 0.03)`)
- Glass card border glow → amber (`hsl(32 100% 50% / 0.15)`)
- Add holographic scanline overlay behind the card
- Title subtitle: "NEXUS AUTHENTICATION TERMINAL" in JetBrains Mono
- Input fields: amber focus ring, terminal-style borders
- Submit button: amber gradient background
- Add rain-streak overlay to the background

### 3. `src/layouts/MainLayout.tsx` — BR2049 Chrome

- Header: amber status dot (replace emerald), add subtle holographic scanline in header bar
- "FX KONTROL" label → amber color with text-shadow glow
- Footer status bar: amber accent for status indicators
- Add `.br2049-vignette` overlay to the main container
- ARMED banner: keep red (safety) but add amber-tinted scan overlay

### 4. `src/components/AppSidebar.tsx` — BR2049 Navigation

- Active nav item: amber glow instead of primary/cyan (`bg-amber-500/10 text-amber-400`)
- Active dot: amber with amber glow shadow
- Brand header: add warm amber underline accent
- Section labels: amber-tinted color
- User avatar ring: amber instead of primary
- Logout hover: keep destructive red

### 5. `src/pages/Dashboard.tsx` — BR2049 Mission Briefing

- Card backgrounds: add subtle amber border-left accent on hover
- News feed cards: amber category highlights
- Quick-access tool grid: amber hover glow on cards
- Stats numbers: amber color for key metrics
- Section headers: JetBrains Mono, amber left-border accent, "MISSION BRIEFING" / "INTEL FEED" / "ARSENAL" labels
- Add rain-streak overlay behind dashboard content

### 6. `src/pages/CommandCenter.tsx` — BR2049 Tactical Console

- Sidebar status header: amber glow ring around status dot
- Section labels: amber tint on section dividers
- Mode buttons: amber highlight for active state (non-fire modes)
- Console frame: add amber scan line in header area
- Mobile bottom nav: amber accent for active tab

### 7. `src/pages/Agenda.tsx` — BR2049 Mission Calendar

- Calendar date highlights: amber accent for selected/today
- Event cards: amber left-border for upcoming events
- Status badges: keep functional colors but add amber glass background
- "+" button: amber accent

### 8. `src/pages/Training.tsx` — BR2049 Simulation Terminal

- Module cards: amber hover glow
- Progress bars: amber fill
- Section headers: "SIMULATION PROTOCOLS" in tactical mono font
- Achievement badges: amber accent outline

### 9. `src/components/FXKAssistant.tsx` — Already BR2049 ✓

Already implements amber holographic identity — no changes needed.

## Files (in priority order)

1. `src/index.css` — Global palette + new BR2049 utilities
2. `src/pages/Auth.tsx` — Login terminal
3. `src/layouts/MainLayout.tsx` — App chrome
4. `src/components/AppSidebar.tsx` — Navigation
5. `src/pages/Dashboard.tsx` — Dashboard
6. `src/pages/CommandCenter.tsx` — Command center
7. `src/pages/Agenda.tsx` — Calendar
8. `src/pages/Training.tsx` — Training

## Technical Notes

- Pure CSS/Tailwind changes — no new dependencies
- No database changes
- Safety-critical colors (red ARM, green SUCCESS) preserved unchanged
- All text opacity minimums maintained (8px desktop, 9px mobile)
- Touch targets 48px+ preserved
- Rain/dust effects use CSS `::before`/`::after` pseudo-elements with `pointer-events: none`

