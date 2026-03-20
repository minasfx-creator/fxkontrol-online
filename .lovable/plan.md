

# Plan: Mobile HUD Overhaul — Free Fire Style for Show Professionals

## Overview
Transform the mobile editor from an opaque-panel layout into a transparent gaming HUD where the 3D world is always 100% visible. All controls become glass overlays. Add real-life show operator features: persistent timecode, connection status, quick-fire controls, countdown timer, and crew communication.

```text
┌──────────────────────────────────┐
│ [⚡FXK] 00:32.15 ▶■  🔋🟢 [☰]  │  ← Glass HUD bar (safe-area)
│                                  │
│ [🎯 Select]                      │  ← Left FABs (context-aware)
│ [➕ Add]                         │
│ [↩ Undo]                         │
│                                  │
│        ═══ 3D WORLD ═══         │  ← Always full-screen
│                                  │
│              [🔴 FIRE]           │  ← Quick-fire floating (armed only)
│                                  │
│ ┌── glass sheet (swipeable) ──┐  │
│ │  Panel content              │  │  ← 25/45/85vh snap points
│ └─────────────────────────────┘  │
│                                  │
│   [⚡] [📍] [⬡] [⏱] [≡]       │  ← Glass floating dock
└──────────────────────────────────┘
```

## Changes (7 files)

### 1. Create `src/components/editor/MobileHUD.tsx`
Transparent top bar replacing full Toolbar on mobile:
- FXK logo icon + live timecode (mono font, cyan)
- Play/Pause/Stop transport (36px icon-only)
- Connection status dots: DMX (green/red), USB (blue/gray), SMPTE (yellow/gray) — reads from stores
- Battery indicator (from useLiveSfxStore if armed)
- Hamburger menu button → opens save/import/export/settings actions via dropdown
- **Show Countdown**: when `showDate` is set in settings, displays "T-2d 4h" countdown
- **PANIC button**: small red circle, visible only when Live FX is armed — triggers emergency stop
- Glass style: `bg-black/25 backdrop-blur-md`, safe-area padding

### 2. Create `src/components/editor/MobileQuickActions.tsx`
Left-edge floating vertical FABs:
- Default state: Select, Add Position, Undo (3 buttons)
- When position selected: Edit, Delete, Duplicate (context-aware swap)
- When Live FX armed: shows ARM status + quick FIRE button (large, red, haptic)
- Semi-transparent glass (`bg-black/30 border border-white/10`), 48px touch targets
- Positioned 8px from left, vertically centered
- **Crew Note button**: tap to dictate/type a quick note timestamped to current timecode (stored in project notes)

### 3. Rewrite `src/components/editor/MobileTabBar.tsx`
Glass floating dock:
- Pill-shaped, floating 8px from edges + safe-area bottom
- `bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl`
- Icon-only (no text), 44px height total
- 5 slots: Live FX (orange glow), Points, Formations, Timeline, More
- Active = neon dot below + `drop-shadow` glow
- **Long-press on Live FX** = instant fullscreen FXcommander (existing LiveFiringPanel fullscreen mode)
- Remove drag handle section from this component (move to MobileFloatingPanel)

### 4. Rewrite `src/components/editor/MobileFloatingPanel.tsx`
Translucent swipeable sheet:
- Glass background: `bg-black/50 backdrop-blur-2xl`
- 3 snap heights: peek (25vh), half (45vh), full (85vh — never 100%)
- Drag handle pill at top (40px × 4px, `bg-white/20`)
- Rounded top corners (`rounded-t-2xl`)
- Close button (X) top-right
- Thin scrollbar inside
- **Swipe-down to dismiss** (touch gesture detection)

### 5. Redesign `src/components/editor/MobileMoreMenu.tsx`
Compact grid with operator-focused organization:
- **Search bar** at top (glass input, instant filter)
- **"Recent" row**: horizontal scroll of last 5 used panels (persisted in localStorage)
- 5-column icon grid (40px cells) with glass cards (`bg-white/5`)
- Category headers as compact inline pills
- **New "Quick Access" section** at top: Show Control, Safety Check, Preflight, Weather — the panels operators need most during a live event
- **New "Crew Tools" section**: Share, Approval, Storyboard, Reports — for coordination

### 6. Edit `src/pages/Index.tsx` — Mobile layout
- Remove `<Toolbar>` from mobile render (line 348)
- Add `<MobileHUD>` as fixed overlay at top (transparent, z-50)
- Add `<MobileQuickActions>` as fixed left overlay (z-40)
- Canvas occupies full screen (`h-screen w-screen`) with no flex column reduction
- All overlays use `pointer-events-none` wrappers with `pointer-events-auto` on children
- Wire `handleMobileOpenPanel` to new components
- Pass transport controls (play/pause/stop) to MobileHUD

### 7. Edit `src/index.css` — Glass utility classes
```css
.glass-hud { background: rgba(0,0,0,0.25); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.08); }
.glass-dock { background: rgba(0,0,0,0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); }
.glass-sheet { background: rgba(0,0,0,0.5); backdrop-filter: blur(24px); }
.glass-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); }
.glow-active { filter: drop-shadow(0 0 8px currentColor); }
.touch-target { min-width: 44px; min-height: 44px; }
```

## Operator-Focused Design Decisions
- **Timecode always visible** — sync checks without opening any panel
- **Connection status at a glance** — DMX/USB/SMPTE colored dots, no panel needed
- **PANIC always reachable** — small red dot in HUD when armed, one tap to emergency stop
- **Live FX priority** — orange glow, long-press for instant fullscreen commander
- **Show countdown** — "T-2d 4h" when show date is set, real-time awareness
- **Crew notes** — timestamped quick notes for field communication
- **Quick Access section** — Safety, Preflight, Show Control, Weather at top of More menu
- **85vh max sheet** — 3D world always peeks through, spatial awareness maintained
- **Context FABs** — buttons change based on selection state, reducing tap count for common ops

## Files Summary

| File | Action |
|------|--------|
| `src/components/editor/MobileHUD.tsx` | Create |
| `src/components/editor/MobileQuickActions.tsx` | Create |
| `src/components/editor/MobileTabBar.tsx` | Rewrite |
| `src/components/editor/MobileFloatingPanel.tsx` | Rewrite |
| `src/components/editor/MobileMoreMenu.tsx` | Redesign |
| `src/pages/Index.tsx` | Edit mobile layout |
| `src/index.css` | Add glass utilities |

