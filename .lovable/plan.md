

# Plan: UX/UI Fixes — Missing Panel Routes, Dead Buttons, Desktop Overlay Conflict

## Issues Found

### 1. Four PanelTabBar panels have no render route (clicking does nothing)
`PanelTabBar` defines these panel IDs with clickable buttons, but `renderPanelContent()` in `Index.tsx` has NO case for them:
- `connections` → should render `ConnectionManagerPanel`
- `radio` → should render `RadioControlPanel`
- `ma3` → should render `MA3ControlPanel`
- `sacnmonitor` → should render `SACNMonitorPanel`

These components exist and are already imported in `LiveFiringPanel.tsx` but never wired into the main editor routing.

### 2. MobileMoreMenu missing 6 panels
`ALL_PANELS` in `MobileMoreMenu.tsx` is missing the newly added panels:
- `bluetooth` (Bluetooth BLE)
- `nfc` (NFC Pair)
- `dmxoutput` (DMX Output)
- `remotecontrol` (Remote Control)
- `connections` (Conexões HW)
- `radio` (Rádio USB)

Users on mobile tapping "More" cannot find these panels at all.

### 3. RemoteReceiverOverlay renders TWICE on desktop
Line 584 mounts `<RemoteReceiverOverlay />` unconditionally as a floating button. But when `activePanel === 'remotecontrol'` on desktop (line 366-370), it renders `<RemoteReceiverOverlay />` AGAIN inside the panel. Two overlapping instances, both creating sessions. Remove the always-mounted instance and only show it via the panel system.

### 4. `VirtualControllerHub` and `FieldMap2D` missing `onClose` prop
Lines 371-372 render `<VirtualControllerHub />` and `<FieldMap2D />` without `onClose`, but every other panel passes `onClose`. These components accept an `fs` prop but not `onClose` in their interfaces. The panel has no close button, trapping users.

## Changes

### 1. `src/pages/Index.tsx` — Add 4 missing panel render cases + fix overlay duplication

Add imports:
```tsx
import ConnectionManagerPanel from '@/components/editor/ConnectionManagerPanel';
import RadioControlPanel from '@/components/editor/RadioControlPanel';
import MA3ControlPanel from '@/components/editor/MA3ControlPanel';
import SACNMonitorPanel from '@/components/editor/SACNMonitorPanel';
```

Add to `renderPanelContent()`:
```tsx
{activePanel === 'connections' && <ConnectionManagerPanel />}
{activePanel === 'radio' && <RadioControlPanel onClose={() => setActivePanel(null)} />}
{activePanel === 'ma3' && <MA3ControlPanel onClose={() => setActivePanel(null)} />}
{activePanel === 'sacnmonitor' && <SACNMonitorPanel onClose={() => setActivePanel(null)} />}
```

Remove the always-mounted `<RemoteReceiverOverlay />` from line 584 (desktop layout bottom). It's already accessible via the `remotecontrol` panel.

### 2. `src/components/editor/MobileMoreMenu.tsx` — Add 6 missing panels

Add to `ALL_PANELS` array in the appropriate sections:
- Conexões section: `bluetooth`, `nfc`, `dmxoutput`, `remotecontrol`, `connections`, `radio`

### 3. `src/components/editor/VirtualControllerHub.tsx` — Accept onClose prop

Add `onClose?: () => void` to props interface and render a close button in the header.

### 4. `src/components/editor/FieldMap2D.tsx` — Accept onClose prop  

Add `onClose?: () => void` to props interface and render a close button in the header.

### 5. `src/pages/Index.tsx` — Pass onClose to VirtualControllerHub and FieldMap2D

```tsx
{activePanel === 'controllers' && <VirtualControllerHub onClose={() => setActivePanel(null)} />}
{activePanel === 'fieldmap' && <FieldMap2D onClose={() => setActivePanel(null)} />}
```

## Files Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add 4 missing panel routes, remove duplicate overlay, pass onClose to 2 panels |
| `src/components/editor/MobileMoreMenu.tsx` | Add 6 missing panel entries |
| `src/components/editor/VirtualControllerHub.tsx` | Add onClose prop + close button |
| `src/components/editor/FieldMap2D.tsx` | Add onClose prop + close button |

