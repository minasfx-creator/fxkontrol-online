

## Quick Hardware Connect — Mobile-First Module

The existing EasyConnectPanel is buried deep in the panel menu system. This plan creates a quick-access hardware overview directly from the MobileHUD, showing all available hardware and their transmission modes at a glance.

### What Gets Built

A new **QuickHardwarePanel** component — a compact, mobile-optimized overlay that shows:
- All detected/simulated hardware grouped by **transport type** (BLE, USB, Art-Net, PBUS, WiFi, Radio)
- Status indicators (online/offline/connecting) with signal bars and battery
- Transport mode badges with color coding per protocol
- One-tap SCAN ALL and per-device connect/test actions
- Accessible via a new **hardware button** on the MobileHUD (replacing the small status dots)

### Architecture

```text
MobileHUD
  └─ [New HW button] ──► QuickHardwarePanel (sheet overlay)
       ├─ Transport Summary Bar (BLE: 2, USB: 1, ArtNet: 3...)
       ├─ Device List (grouped by transport)
       │    ├─ Device card: name, status dot, RSSI bars, battery, latency
       │    └─ Connect/Test button per device
       └─ Footer: SCAN ALL + TEST ALL
```

### Files to Create/Modify

1. **`src/components/editor/QuickHardwarePanel.tsx`** (NEW)
   - Compact mobile-first hardware overview
   - Reuses the same hooks as EasyConnectPanel (`useFireOneHardware`, `usePBusHardware`, `useUSBDeviceStore`, `artnetModuleService`)
   - Adds transport grouping with collapsible sections
   - Transport summary bar at top showing count per protocol
   - Includes radio devices from `useUSBDeviceStore` filtered by type
   - SIM mode toggle for demo/field operation
   - Large 48px touch targets for all interactive elements

2. **`src/components/editor/MobileHUD.tsx`** (MODIFY)
   - Add a hardware status button (antenna/radio icon) that opens QuickHardwarePanel
   - Replace the tiny 1.5px status dots with a proper touch target
   - Show aggregate online count badge on the button

3. **`src/pages/Index.tsx`** (MODIFY)
   - Add `quickhw` as a new panel option or handle it as a MobileHUD-local sheet
   - Wire up the panel opening from MobileHUD

### Key Design Decisions
- **Mobile-first**: Full-width bottom sheet with 48px min touch targets
- **Grouped by transport**: Each transport type (BLE/USB/ArtNet/PBUS/WiFi/Radio) gets a collapsible section header showing protocol name + device count
- **Instant access**: One tap from MobileHUD — no menu diving
- **Reuses existing infrastructure**: Same hooks, stores, and artnet service — no new data layer needed

