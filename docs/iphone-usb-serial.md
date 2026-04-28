# iPhone ↔ USB Serial Integration — FX KONTROL

## Why iOS PWA can't reach USB

| API              | iOS Safari (PWA) | Capacitor (native) |
|------------------|------------------|--------------------|
| WebUSB           | ❌ Not supported  | ✅ via plugin      |
| Web Serial API   | ❌ Not supported  | ✅ via plugin      |
| Web Bluetooth    | ❌ Not supported  | ✅ via plugin      |
| Lightning USB-OTG| ❌ Sandboxed      | ✅ MFi / CDC-ACM   |

The PWA path can ONLY use BLE through `@capacitor-community/bluetooth-le`
(or fall back to a paired BLE-bridge dongle). Anything that looks like a
COM port — PBUS transceivers, FTDI adapters, USB-DMX dongles, FX-Commander
Pro — requires the **native Capacitor build** below.

---

## Step-by-step iPhone build

### 1. Sync from Lovable to your machine

```bash
git pull                # pull latest from your repo
npm install
npx cap add ios         # one-time — creates ios/ folder
npx cap update ios
npm run build           # build the React app
npx cap sync            # copy dist/ into the iOS project
```

### 2. Add a USB Serial plugin

Choose one (both wrap the iOS ExternalAccessory framework or CDC-ACM):

```bash
# Option A — community plugin (recommended for FTDI/CP210x/CH340)
npm install @adeunis/capacitor-serial

# Option B — Cordova fallback (older but proven)
npm install cordova-plugin-usbserial
```

After install:
```bash
npx cap sync ios
```

### 3. Edit `ios/App/App/Info.plist`

Add these keys (Xcode: right-click Info.plist → "Open as Source Code"):

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>FX KONTROL needs Bluetooth to talk to wireless DMX/firing dongles.</string>

<key>NSBluetoothPeripheralUsageDescription</key>
<string>FX KONTROL pairs with field hardware over BLE.</string>

<!-- For MFi (Made for iPhone) USB-C/Lightning accessories -->
<key>UISupportedExternalAccessoryProtocols</key>
<array>
  <string>com.silabs.cp210x</string>
  <string>com.ftdichip.cdc.acm</string>
</array>

<!-- Allow background USB I/O (firing windows can exceed foreground limits) -->
<key>UIBackgroundModes</key>
<array>
  <string>external-accessory</string>
  <string>bluetooth-central</string>
</array>
```

### 4. Build & run on a real iPhone

```bash
npx cap open ios        # opens Xcode
# In Xcode:
#   • Signing & Capabilities → set your team
#   • Plug iPhone in (USB-C / Lightning)
#   • Product → Run (⌘R)
```

The first launch will prompt for:
- USB device permission (per-device, persistent)
- Bluetooth permission

### 5. Verify USB detection in-app

Open the **Hardware → Discovery** panel. You should see:
- Detected Serial ports listed (e.g. `/dev/cu.usbserial-…` mapped to virtual port name)
- BLE devices in advertising range

The `[FXK Hardware]` console banner will print `0 simulated, N real`
once a port is authorized.

---

## Troubleshooting "iPhone won't see the USB device"

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Lightning adapter shows "accessory not supported" | Not MFi-certified | Use Apple-certified Lightning→USB-3 Camera Adapter, NOT a generic OTG cable |
| USB-C iPad: device draws too much power | iPad gives ~500mA | Use a powered USB hub between iPad and target |
| App lists no ports | Plugin not synced | `npm run build && npx cap sync ios` then re-run from Xcode |
| Port appears then disappears | Background suspend killed I/O | Add `external-accessory` to `UIBackgroundModes` (step 3) |
| MFi protocol not whitelisted | Device uses non-standard protocol | Contact device vendor for the protocol string, add to `UISupportedExternalAccessoryProtocols` |
| `cap sync` errors about CocoaPods | Pods out of date | `cd ios/App && pod install --repo-update` |

---

## Hot-reload during development

`capacitor.config.ts` already points `server.url` to the Lovable sandbox,
so the iPhone runs the live preview without rebuilding. **Remove this
block before submitting to TestFlight / App Store** — Apple rejects apps
that load primary content from a remote URL.

---

## Production checklist (when leaving testing)

- [ ] Remove `server.url` block in `capacitor.config.ts`
- [ ] Restore safety quarantine (see `src/_quarantine/safety/README.md`)
- [ ] Build production bundle: `npm run build && npx cap sync ios`
- [ ] Increment `CFBundleShortVersionString` and `CFBundleVersion` in `Info.plist`
- [ ] Archive in Xcode → Distribute App → App Store Connect
