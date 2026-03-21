

# Plan: Fix Mobile Menu + Panel Rendering + Missing Panel Routes

## Issues Found

### Critical: Mobile bottom tabs do nothing (4 out of 5 broken)
**Root cause**: When MobileTabBar tabs with `panelId` (Live FX, Control, Remote, Map) are tapped:
1. `onOpenPanel(panelId)` is called → routes to `handleTogglePanel` → sets `activePanel`
2. `onTabChange(tab)` → sets `mobileTab` to e.g. `'remote'`
3. `onPanelHeightChange('full')` → sets height

But the `MobileFloatingPanel` children only handle `mobileTab === 'timeline' | 'assets' | 'properties' | 'more'`. The second `MobileFloatingPanel` requires `mobileTab === null`. So panel-based tabs fall through both paths → nothing renders.

### Critical: `controllers` and `fieldmap` panels have no render case
`renderPanelContent()` has no entry for `activePanel === 'controllers'` or `activePanel === 'fieldmap'`. MobileTabBar routes to them but they render nothing even if the rendering bug above is fixed.

### Issue: `handleMobileOpenPanel` sets `mobileTab(null)` — conflicts with tab highlighting
When `handleMobileOpenPanel` is called from `MobileMoreMenu`, it correctly sets `mobileTab(null)`. But `MobileTabBar.handleTabClick` calls `onOpenPanel` first, then `onTabChange(tab)` — however `onOpenPanel` maps to `handleTogglePanel` (line 429), NOT `handleMobileOpenPanel`. So `handleTogglePanel` just toggles `activePanel` but doesn't set `mobileTab(null)`, which is correct for tab-based panels. But `handleMobileOpenPanel` (used by MobileMoreMenu) does set `mobileTab(null)`, which blocks the second floating panel from rendering. This is actually fine for "More" submenu, but the tab-based flow is broken.

### Issue: `ConnectionManagerPanel` calls `discoverModules(20)` instead of 40
Line 128: `await fireone.discoverModules(20)` — should be 40 per the FireOne fix.

### Issue: `RemoteReceiverOverlay` only on desktop, no way to open it from panel
The overlay is always mounted on desktop (line 572) but it's a small floating button. If user opens `remotecontrol` panel on desktop, they get the mobile controller panel (meant for mobile), not the receiver. Need to show receiver-appropriate UI on desktop.

## Changes

### 1. `src/pages/Index.tsx` — Fix mobile panel rendering (CRITICAL)

Add fallback in the first `MobileFloatingPanel` for panel-based tabs:
```tsx
{mobileTab === 'timeline' && <Timeline />}
{mobileTab === 'assets' && <EffectLibrary />}
{mobileTab === 'properties' && <PropertiesPanel />}
{mobileTab === 'more' && <MobileMoreMenu onSelectPanel={handleMobileOpenPanel} />}
{/* Panel-based tabs (livefx, controllers, remote, fieldmap) */}
{mobileTab && !['timeline','assets','properties','more'].includes(mobileTab) && activePanel && (
  <div className="h-full overflow-y-auto">{renderPanelContent()}</div>
)}
```

Add missing panel entries to `renderPanelContent()`:
- `controllers` → render `VirtualControllerHub` (already imported? check) or `ConnectionManagerPanel`
- `fieldmap` → render `FieldMap2D`

### 2. `src/pages/Index.tsx` — Add missing panel imports and render cases

Add to `renderPanelContent()`:
```tsx
{activePanel === 'controllers' && <VirtualControllerHub onClose={() => setActivePanel(null)} />}
{activePanel === 'fieldmap' && <FieldMap2D onClose={() => setActivePanel(null)} />}
```

Import `VirtualControllerHub` and `FieldMap2D` at top.

### 3. `src/components/editor/ConnectionManagerPanel.tsx` — Fix discoverModules(20) → 40

Line 128: change `discoverModules(20)` to `discoverModules(40)`.

### 4. `src/pages/Index.tsx` — Desktop `remotecontrol` panel should show receiver info

When `activePanel === 'remotecontrol'` on desktop, show a combined view: the `RemoteReceiverOverlay` session start inline, not the mobile controller. Add a wrapper that detects `isMobile` and renders `RemoteControlPanel` on mobile, receiver UI on desktop.

## Files Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Fix mobile floating panel fallback, add controllers/fieldmap render cases, desktop remote panel logic |
| `src/components/editor/ConnectionManagerPanel.tsx` | Fix discoverModules(20) → 40 |

