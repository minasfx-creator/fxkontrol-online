## FXK16 BLE Pairing Wizard

Add a guided BLE pairing flow that scans for `FXK16-XXXXXX` devices, connects over the BLE-UART service, reads the firmware handshake (`MODEL:FXK16;CH:16;FW:1.3.0;ID:...`), and shows real-time per-attempt status. Mirrors the existing 5-step USB wizard pattern (`/pairing/usb`) so operators get a consistent experience across transports.

### What gets built

**New route**: `/pairing/ble` (lazy in `src/App.tsx`)

**Page**: `src/pages/BlePairingWizard.tsx` — 4 steps
1. **Welcome** — checks Web Bluetooth support, platform hints (iOS = unsupported → suggest USB wizard, Android Chrome / desktop = OK)
2. **Scan** — calls `navigator.bluetooth.requestDevice` filtered by `namePrefix: 'FXK16-'` + service `0000ffe0-...`. Picker shows only matching devices.
3. **Handshake** — opens GATT, subscribes to RX notify char, sends `VERSION\n` then `STATUS\n` on TX char, waits up to 3s for `MODEL:FXK16;CH:16;FW:...;ID:...`. Parses tokens and displays them.
4. **Success** — shows model, channel count, firmware, device ID; CTAs: "Pair another", "Open FXK Pyro Console", "Done".

**Per-attempt status panel** (visible from step 2 onward): a scrollable list of attempts with timestamp, device name, outcome chip (Connecting / Handshake OK / Timeout / Cancelled / GATT error), latency in ms, and the raw handshake line. Capped at 20 entries (in-memory + persisted to `pairingAuditLog` for cross-session history).

**Reuses existing infrastructure**:
- `FireOneHardwareBridge.connectBLE()` already implements the GATT setup + `establishHealthyLink` handshake that parses `MODEL:` and `CH:` tokens. The wizard wraps it with explicit per-attempt event capture.
- `pairingAuditLog.recordPairing()` for success/failure log entries (transport: `'ble'`).
- `portRegistry.upsert` keyed by `ble:${deviceId}` so the device is remembered for auto-reconnect by `DeviceAggregator`.
- `WizardStepIndicator` and step-shell layout from `src/components/pairing/`.

**New components** under `src/components/pairing/ble/`:
- `BleWelcomeStep.tsx`
- `BleScanStep.tsx` (wraps requestDevice; surfaces NotFoundError, SecurityError, NotSupportedError with actionable hints)
- `BleHandshakeStep.tsx` (drives bridge, shows attempt log)
- `BleSuccessStep.tsx`
- `AttemptLogList.tsx` (shared status panel)

**Entry points wired**:
- "Pair via Bluetooth" button added to `EasyConnectPanel.tsx` next to the existing USB wizard CTA.
- Link added to the hardware overview at `/command?mode=hw_overview`.

### Technical details

- BLE UUIDs already match the FXK16 firmware (`fireoneModuleHardwareBridge.ts` constants, also defined in `firmware/fxk16-esp32s3/src/main.ino`):
  - Service `0000ffe0-0000-1000-8000-00805f9b34fb`
  - TX (host→device, write) `0000ffe1-...`
  - RX (device→host, notify) `0000ffe2-...`
- Handshake parser: read notify chunks, accumulate until `\n`, match `MODEL:FXK16` AND `CH:16` within 3s window. Extract `FW:` and `ID:` tokens for display.
- All timers tracked via `useRef` and cleared on unmount (per Core memory rule).
- Hard-gate compliance: this wizard only **discovers and identifies** — never sends FIRE. No CommandBus interaction. Live operational firing continues to flow through the existing `UI → ShowPlan → CommandBus → SafetyStateMachine → FieldBus` path.
- Honest hardware: on failure, no synthetic device is registered. `portRegistry.upsert` is called only on confirmed handshake.
- iOS handling: Web Bluetooth is unavailable in iOS Safari/WKWebView. The Welcome step detects this via `platformCapabilities` and routes the user to `/pairing/usb` with an explanation.

### Files touched

```text
src/App.tsx                                       (+1 lazy route)
src/pages/BlePairingWizard.tsx                    (new)
src/components/pairing/ble/BleWelcomeStep.tsx     (new)
src/components/pairing/ble/BleScanStep.tsx        (new)
src/components/pairing/ble/BleHandshakeStep.tsx   (new)
src/components/pairing/ble/BleSuccessStep.tsx     (new)
src/components/pairing/ble/AttemptLogList.tsx     (new)
src/components/editor/EasyConnectPanel.tsx        (+ BLE wizard CTA)
```

No firmware, store, or backend changes required. No new dependencies. No DB migrations.

### Out of scope

- Firing/test commands from the wizard (use `/dev/fxk16-validate` for that).
- BLE Long Range pairing (separate `connectBLELongRange` already exists; can be added as a step variant later).
- Multi-device batch pairing.
