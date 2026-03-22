

# FXK Platform — Gaps & Refinements for Real Show Operations

## Real-World Gaps Identified

After analyzing the full codebase against real show site conditions, here are the critical gaps:

### 1. **Backlight / Readability in Dark Environments**
Show sites are always dark — operators work with headlamps off to avoid blinding performers/audience. Current issues:
- Text at `text-muted-foreground/20`, `/25`, `/30`, `/35`, `/40` is **unreadable** outdoors at night
- Active tab indicators use tiny 1-2px dots that disappear in peripheral vision
- Borders at `/05`, `/06`, `/08` provide zero visual separation on dark screens with glare
- The backlight slider in Settings only stores a value but **doesn't actually adjust anything** — it's decorative

### 2. **Touch Targets Too Small for Gloved Hands**
Pyro operators often wear work gloves. Current issues:
- Command Center mode buttons: `min-h-[36px]` — too small with gloves
- Mobile bottom nav buttons: `py-1.5 px-3` — barely 32px
- PanelTabBar items: `px-2.5 py-1.5` — ~28px height
- Need minimum **48px** touch targets for mission-critical buttons

### 3. **No Ambient Light Adaptation**
- No "night mode" / "show mode" that maximizes contrast
- No option to dim non-essential UI (news feed, stats) during live show
- The backlight setting should actually control a CSS opacity/brightness filter on the whole UI

### 4. **Critical Status Visibility**
- ARMED state: only a tiny badge — needs to be an unmissable full-width bar
- Connection loss: no persistent warning — just a dot changing color
- No audio/haptic feedback on ARM/DISARM state changes

### 5. **Dashboard Noise During Show Day**
- Instagram-style news feed occupies the center column — irrelevant on show day
- No "Show Day" mode that surfaces only: next event countdown, hardware status, quick-launch to Command Center

### 6. **Missing Emergency Access**
- PANIC button only exists inside LiveFiringPanel — needs to be globally accessible when armed
- No quick-return to Command Center from any screen when armed

## Plan

### Step 1: Fix Contrast & Readability (index.css + components)

**index.css changes:**
- Raise all `muted-foreground` minimum from `/20` → `/50` in interactive elements
- Add new utility classes:
  - `.high-contrast` — forces minimum brightness on all text children
  - `.night-mode` — CSS class on `<body>` that applies `filter: brightness(var(--ui-brightness))` controlled by backlight slider
- Increase border opacity minimums from `/05` → `/12`

**Component changes across all files:**
- Replace all `text-muted-foreground/20`, `/25`, `/30` with minimum `/50` for interactive elements
- Replace `/35`, `/40` with minimum `/55` for labels
- Keep `/20`-`/30` only for truly decorative elements (grid lines, scanlines)

### Step 2: Enlarge Touch Targets for Show Operations

**CommandCenter.tsx:**
- Mobile mode pills: `min-h-[36px]` → `min-h-[48px]`
- Bottom nav buttons: add `min-h-[48px] min-w-[48px]`
- Desktop sidebar buttons: `py-1.5` → `py-2.5`

**MobileTabBar.tsx:**
- Tab buttons: enforce `min-h-[52px]` with larger icons (`w-6 h-6`)

### Step 3: Make Backlight Slider Functional

**MainLayout.tsx:**
- Read backlight value from a global store/localStorage
- Apply `filter: brightness(${backlight}%)` on the main app container
- Default: 80% (comfortable for dark sites)

**New: `src/store/useDisplayStore.ts`**
- Stores `backlight` (10-100), `nightMode` (bool), `showMode` (bool)
- Persists to localStorage

### Step 4: Global ARMED Banner

**MainLayout.tsx:**
- When any effects are armed (read from `useLiveSfxStore`), render a persistent top bar:
  - Full-width, `bg-destructive/90`, pulsing, with text "⚠ SYSTEM ARMED — X CHANNELS HOT"
  - Click navigates to Command Center
  - Cannot be dismissed while armed

### Step 5: Show Day Dashboard Mode

**Dashboard.tsx:**
- Detect if there's an event today (`daysUntilNext === 0`)
- Auto-switch to a simplified "Show Day" layout:
  - Full-width countdown timer to event start
  - Hardware status grid (connected/disconnected per device type)
  - Single large "ENTER COMMAND MODE" button
  - Hide news feed, stats, project list
- Manual toggle: "Show Day Mode" switch in hero banner

### Step 6: Global Emergency FAB

**MainLayout.tsx:**
- When armed, show a floating PANIC button (bottom-right, 64x64, red, pulsing)
- Fires all-stop on `useLiveSfxStore`
- Visible on ALL pages, not just Command Center

## Files Modified

1. `src/index.css` — contrast utilities, night mode, touch target classes
2. `src/store/useDisplayStore.ts` — new store for display settings
3. `src/layouts/MainLayout.tsx` — backlight filter, ARMED banner, PANIC FAB
4. `src/pages/CommandCenter.tsx` — touch target sizes, contrast fixes
5. `src/pages/Dashboard.tsx` — Show Day mode, contrast fixes
6. `src/components/editor/MobileTabBar.tsx` — larger touch targets
7. `src/components/editor/live-firing/SettingsPanel.tsx` — wire backlight to real store

