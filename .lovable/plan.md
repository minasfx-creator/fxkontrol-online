

## Plan: Pyro Console Aesthetic Fix + Weapon Drop Animation + Tactical Minimap

### 4 Deliverables

---

### 1. Align Pyro Console Aesthetic with BR2049/Free Fire Theme

**Problem**: The `LiveFiringPanel` (used by pyro_fire and super_dmx) still uses plain `hsl(220 10% 8%)` backgrounds, generic borders, and no HUD brackets or accent glows — visually inconsistent with the refreshed Command Center shell.

**File: `src/components/editor/LiveFiringPanel.tsx`**
- When `standalone` is true (Command Center mode), wrap the entire panel in a container that inherits the console accent color
- Replace the scene buttons (S0-S3) background with translucent glass style matching the weapon-rail aesthetic
- Add accent-colored top border glow to the ARM/PANIC bar
- Replace mode tab styling with compact FF-style buttons (matching `.ff-weapon-slot` visual language)
- Add subtle scanline overlay to the panel header area
- Update the Device List header and CUE Setting header to use accent-colored labels instead of plain `muted-foreground/50`

### 2. "Weapon Drop" Bounce Animation on Console Swap (Mobile)

**File: `src/pages/CommandCenter.tsx`**
- Replace the current `swap-in` / `swap-out` CSS transitions with a new "weapon-drop" animation
- On swap-out: content scales down (0.95) + slight upward translate + opacity fade (200ms)
- On swap-in: content drops from above (translateY(-30px) → 0) with spring bounce overshoot + scale(1.02 → 1) + opacity 0→1 (400ms, cubic-bezier spring curve)

**File: `src/index.css`**
- Add `@keyframes weapon-drop-in` and `@keyframes weapon-drop-out`
- `weapon-drop-in`: `0% { opacity:0; transform: translateY(-30px) scale(0.96) } 60% { transform: translateY(4px) scale(1.01) } 100% { opacity:1; transform: translateY(0) scale(1) }`
- `weapon-drop-out`: `0% { opacity:1; transform: scale(1) } 100% { opacity:0; transform: translateY(-15px) scale(0.95) }`
- Apply `.swap-out { animation: weapon-drop-out 0.2s ease-in forwards }` and `.swap-in { animation: weapon-drop-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards }`

### 3. Tactical Minimap in Landscape HUD

**File: `src/pages/CommandCenter.tsx`** (landscape mobile section, lines 197-310)
- Add a 100x80px tactical minimap container in the bottom-left corner (absolute positioned, z-30)
- Display a simplified 2D canvas showing:
  - Grid lines (tactical style, accent color at 10% opacity)
  - Module positions from `useFireOneHardware()` as colored dots (green = connected, red = offline)
  - PBUS device positions as smaller amber dots
  - Safety radius circles around each module (translucent red, 15% opacity)
  - Antenna/transmitter position as a pulsing cyan dot
- Border: 1px accent color at 30% opacity, rounded-lg, glass background
- Label: "FIELD" in 6px mono uppercase at top-left corner
- The minimap reuses position data from `FieldMap2D`'s module positioning logic but renders as a tiny canvas overlay

**New component: `src/components/editor/TacticalMinimap.tsx`**
- Lightweight canvas-based component (~80 lines)
- Props: `accentColor`, `width`, `height`
- Uses `useFireOneHardware()` and `usePBusHardware()` for device positions
- Renders on a 2D canvas with requestAnimationFrame loop
- Grid pattern + device dots + safety zones

### 4. CSS Updates

**File: `src/index.css`**
- Update `.holo-swap-container .swap-in` and `.swap-out` classes with weapon-drop keyframes
- Add `.ff-tactical-minimap` class for the minimap container styling

---

### Technical Notes
- The pyro aesthetic fix targets only `standalone` mode to avoid breaking the editor's embedded LiveFiringPanel
- The weapon-drop animation applies to both landscape and portrait mobile console transitions
- The minimap is canvas-based (not DOM) for performance — avoids adding 20+ DOM elements to the landscape HUD
- All changes maintain the existing `handleModeChange` → `ConsoleBootSequence` → `handleBootComplete` flow

