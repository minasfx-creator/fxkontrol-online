

# UI/UX Revision — Command Center + DockBar + Fullscreen

## Issues Identified

1. **DockBar hidden on Command page**: MainLayout line 49-50 explicitly excludes `/command` with `!isCommand`, so neither desktop nor mobile dock renders there.

2. **Old console tabs still visible**: Inside `LiveFiringPanel.tsx`, the desktop tab bar (line 1032-1048) shows 15 legacy tabs (Simple DMX, Manual Fire, Check Slave, Controllers, PBUS, MA3, Map, Connections, WiFi Direct, ArtNet, Mobile Link, Settings). These are internal sub-modes that should not appear when the panel runs inside CommandCenter's 7-console architecture — they duplicate functionality now handled by separate console panels (MA3ControlPanel, DroneCommandPanel, FXKNetPanel, etc.).

3. **Fullscreen conflict**: CommandCenter renders inside MainLayout's `<main>` which applies `overflow-auto p-4 md:p-6` padding. The Command page tries to be fullscreen with `h-[calc(100vh-3rem)]` but the padding and overflow from MainLayout break this.

## Changes

### 1. Show DockBar on Command page (MainLayout.tsx)

Remove the `!isCommand` exclusion from `showDock` and `showMobileDock`. The Command page already handles its own bottom nav on mobile, so we conditionally show the DockBar only on desktop for Command, and let mobile Command keep its own category nav.

```
const showDock = !isEditor && !isMobile;
const showMobileDock = !isEditor && !isCommand && isMobile;
```

Also make the `<main>` tag remove padding for `/command` (same as it does for `/editor`):

```
<main className={`${(isEditor || isCommand) ? 'flex-1 min-h-0' : 'flex-1 overflow-auto p-4 md:p-6'} relative`}
```

### 2. Clean up LiveFiringPanel desktop tabs when in standalone mode

When `standalone` prop is true (used by CommandCenter), hide the legacy sub-mode tabs and only show the firing-relevant tabs: `super_dmx`, `simple_dmx`, `manual_fire`, `pyro_fire`, `auto_fire`. Remove the hardware/connection tabs that are now separate consoles in the CommandCenter architecture.

In `LiveFiringPanel.tsx`, filter the desktop tab list when `standalone` is true to show only:
- Super DMX, Simple DMX, Manual Fire, Pyro Fire, Auto Fire, Check Slave

### 3. Fix CommandCenter desktop height

Change `h-[calc(100vh-3rem)]` to `h-full` since the parent `<main>` now handles the fullscreen layout with `flex-1 min-h-0`.

### 4. Adjust DockBar z-index on Command page

The CommandCenter has a sidebar at z-index default — ensure the DockBar's `z-40` doesn't conflict. Add `pb-14` (dock height padding) to the CommandCenter desktop layout so content doesn't hide behind the dock.

## Files Modified

| File | Change |
|------|--------|
| `src/layouts/MainLayout.tsx` | Show dock on Command, remove padding for Command page |
| `src/pages/CommandCenter.tsx` | Change height from calc to h-full, add bottom padding for dock |
| `src/components/editor/LiveFiringPanel.tsx` | Filter legacy tabs when `standalone` is true |

