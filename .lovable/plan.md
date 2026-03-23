

## Plan: Mobile Console — Free Fire Game HUD + BR2049 Military

### What the user wants
Mobile consoles styled like **Free Fire** (battle royale mobile game): fullscreen landscape HUD with transparent overlays, compact weapon-style quick-select, minimap-like telemetry, health/ammo bar patterns — all fused with the existing **Blade Runner 2049 military** aesthetic.

### Current State
- Landscape mobile already exists (lines 191-281) with nav rail + top bar
- Portrait mobile exists (lines 287-402) with floating dock
- Both work but feel like "generic dashboard" — not game-like

### Changes

#### File: `src/pages/CommandCenter.tsx`

**Landscape Mobile (Free Fire HUD Overhaul):**
1. **Top HUD bar → Ultra-compact game bar** (24px): Kill the current plain bar. Replace with translucent strip showing:
   - Left: Console logo + label (small)
   - Center: Mission clock in amber LCD style + ARM status as a pulsing red dot (not a badge)
   - Right: Connection count as signal bars (not text) + miniature battery/signal icons

2. **Left nav rail → Weapon wheel style**: Replace plain icon buttons with circular/hexagonal console selector buttons with:
   - Active console: bright accent ring + glow pulse (like selected weapon in Free Fire)
   - Inactive: dim, ghosted, no labels
   - Reduce width from 44px to 40px
   - Add thin vertical accent line on active (weapon slot indicator)

3. **Content area**: Add semi-transparent tactical grid overlay (like Free Fire's map grid) with accent-colored gridlines at 5% opacity. Keep HUD corner brackets but make them thicker (3px) and add subtle animation (slow pulse on accent color).

4. **Quick-action bar (NEW)**: Add a floating horizontal bar at bottom-right (like Free Fire's action buttons) with:
   - E-STOP button (red, circular, large, pulsing border)
   - ARM/SAFE toggle (compact, high contrast)
   - Fullscreen toggle
   - Semi-transparent glass background, rounded-2xl

**Portrait Mobile (Game Lobby Style):**
5. **Floating dock → Game-style tab bar**: Make the bottom nav more aggressive:
   - Hexagonal icon containers instead of plain circles
   - Active category: bright glow ring + accent color fill
   - Background: darker (3% lightness), more transparent blur
   - Add subtle "ammo counter" style badge showing number of consoles in each category

6. **Console selector cards → Weapon loadout cards**: Replace horizontal scroll buttons with taller cards (64px) showing:
   - Console logo prominent (24px)
   - Label below in mono uppercase
   - Active: full accent border glow + corner brackets
   - Inactive: ghosted with thin border

7. **Top HUD → Military briefing bar**: More compact, add scanline overlay to the bar itself

#### File: `src/index.css`

8. **New CSS classes**:
   - `.ff-weapon-slot` — hexagonal/rounded selector with glow ring states
   - `.ff-hud-grid` — tactical grid overlay (repeating linear gradient)
   - `.ff-action-ring` — circular action button with pulsing border
   - `.ff-signal-bars` — mini signal strength indicator (3 bars)
   - Enhance `.landscape-hud-bar` and `.landscape-nav-rail` with darker, more transparent backgrounds
   - Add `@keyframes weapon-select-pulse` for active console glow animation

#### Fullscreen enforcement
9. In `CommandCenter.tsx`, add a `useEffect` that calls `document.documentElement.requestFullscreen()` on mobile landscape mount (with try/catch), and exits fullscreen on unmount

### Visual Reference (Free Fire mapping)
```text
┌──────────────────────────────────────────────┐
│ [LOGO] FXK-PYRO    T+00:12:45  ●ARM  ▮▮▮ │  ← Top HUD (24px, translucent)
├────┬─────────────────────────────────────────┤
│ ◯  │                                         │
│ ◉  │   [ MAIN CONSOLE CONTENT ]              │  ← Content + grid overlay
│ ◯  │                                         │
│ ◯  │       ┌─────────────────┐               │
│ ◯  │       │  tactical grid  │               │
│ ◯  │       └─────────────────┘               │
│ ◯  │                          [⊘] [ARM] [⛶] │  ← Quick-action bar (floating)
└────┴─────────────────────────────────────────┘
  ↑ Weapon wheel (40px)
```

### Build verification
- TypeScript build check for 0 errors
- Test on mobile viewport (landscape + portrait)

