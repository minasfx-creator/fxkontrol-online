

# IFMx-i32Q Virtual Module — Réplica Funcional + Hardware DIY

## Resposta sobre Hardware

**Sim, é possível transformar seu celular em um módulo IFMx-i32Q virtual.** O hardware mínimo necessário:

```text
┌──────────────────────────────────────────────────────┐
│                SMARTPHONE (FX KONTROL)               │
│   Roda o Virtual IFMx-i32Q Module                    │
│   Comunica via WebSocket (Wi-Fi) com o Controller    │
└──────────────────┬───────────────────────────────────┘
                   │ Wi-Fi / USB-C OTG
┌──────────────────▼───────────────────────────────────┐
│           ESP32 + Relay Board (Hardware)              │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐            │
│  │ ESP32   │──│ ULN2803  │──│ 32x Relé │── Igniters │
│  │ (Wi-Fi) │  │ (Driver) │  │ 5V/12V   │            │
│  └─────────┘  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌───────────┐                         │
│  │ Battery  │  │ CDS Cap   │  Capacitor discharge    │
│  │ 12V LiPo │  │ 470µF x32 │  for e-match ignition  │
│  └──────────┘  └───────────┘                         │
└──────────────────────────────────────────────────────┘
```

**Lista de componentes (~$25-40):**
- ESP32 DevKit ($5) — Wi-Fi + BLE + USB
- ULN2803 x4 ou placa de 32 relés ($10-15)
- Capacitores 470µF 25V x32 ($5) — CDS (Capacitive Discharge System)
- Bateria LiPo 3S 12V ($8)
- Bornes de conexão para e-matches

**Alternativa mais simples (~$15):** ESP32 + 4x ULN2803 (sem relé, disparo direto por transistor Darlington). Funciona para e-matches de baixa corrente.

**Só com celular?** Sem hardware externo o celular pode atuar como módulo virtual para **simulação e teste**, mas para disparo real precisa do circuito de potência (relé/transistor + capacitor).

## Architecture

```text
FX KONTROL (Controller/Master)
    │
    ├── Wi-Fi Transport (WebSocket)
    │   └── Celular rodando VirtualIFMx32Q component
    │       ├── Recebe: ARM, FIRE, CONTINUITY, STATUS
    │       ├── Responde: ACK, igniter status, battery
    │       └── Se conectado a ESP32 via USB/BLE:
    │           └── Roteia FIRE → GPIO → Relé → E-match
    │
    └── Serial Transport (RS-485)
        └── Módulo IFMx-i32Q real (compatível)
```

## Changes

### 1. `src/lib/fireoneModuleEmulator.ts` (NEW) — IFMx-i32Q Protocol Emulator

Core engine that turns the browser into a field module:

- **Module state machine**: `IDLE → SAFE_SENSE → READY → ARMED → FIRING`
- **Protocol handler**: Parses incoming FireOneController frames (STX/CMD/PAYLOAD/ETX), responds with proper ACK/NAK/status
- **32 igniter channels**: Each with continuity state, resistance simulation, fired flag
- **CDS emulation**: Capacitor charge tracking per channel (real i32Q uses capacitive discharge)
- **Safe-Sense sequence**: 3-second power-up safety check (per manual)
- **Command handling**: ARM, DISARM, FIRE (with duration clamping 20-1000ms), CONTINUITY, STATUS, E-STOP, IDENTIFY
- **Hardware bridge interface**: `onFire(pin, durationMs)` callback for routing to real GPIO via ESP32

### 2. `src/lib/fireoneModuleHardwareBridge.ts` (NEW) — ESP32/GPIO Bridge

Bridge between virtual module and physical hardware:

- **Web Bluetooth BLE** connection to ESP32 (characteristic-based GPIO control)
- **WebSerial USB** connection to ESP32 (serial commands: `FIRE:pin:duration\n`)
- **WebSocket** connection to ESP32 running local server
- Simple protocol: `GPIO_SET pin HIGH/LOW`, `FIRE pin durationMs`, `READ_CONTINUITY pin`
- ESP32 firmware spec (documented in comments): Arduino sketch that listens for serial/BLE commands and drives ULN2803 outputs
- Continuity readback: ESP32 measures resistance via ADC and reports back

### 3. `src/components/editor/live-firing/VirtualIFMx32QPanel.tsx` (NEW) — Full Module Replica UI

Visual replica of the physical IFMx-i32Q front panel:

- **Touch-sensitive LCD display** (address 01-99) with up/down buttons
- **32 igniter grid** (4x8 layout matching the Centronics 36-pin connector pinout)
- **Status LEDs**: F.P (Fire Power), COM (Communication), ON (Power), RF (Wireless), CHG (Charging)
- **Battery voltage** display, **signal strength** bar
- **Connection indicator**: wired (2-Wire) vs wireless vs hardware bridge
- **CDS charge status** per channel (capacitor charge animation)
- **ARM/DISARM** visual state with red/green border
- **Fire feedback**: Channel flashes amber on fire with duration indicator
- **Hardware bridge status**: Shows if ESP32 is connected and which pins have real hardware

### 4. `src/hooks/useFireOneModuleMode.ts` (NEW) — Module Mode Hook

React hook that switches the app from Controller mode to Module mode:

- Creates `FireOneModuleEmulator` instance
- Connects to controller via Wi-Fi transport (WebSocket) as a "slave"
- Registers with controller's module discovery (responds to IDENTIFY)
- Manages hardware bridge lifecycle (BLE/USB/WebSocket to ESP32)
- Exposes: `moduleAddress`, `armed`, `igniters[]`, `batteryVoltage`, `cdsCharge`, `hardwareBridgeConnected`
- Provides `setAddress()`, `connectHardware()`, `disconnectHardware()`

### 5. `src/components/editor/LiveFiringPanel.tsx` — Add Module Mode entry

Add a new FXCMode entry `'module'` that renders VirtualIFMx32QPanel. Accessible from VirtualControllerHub as "IFMx-i32Q Module (Virtual)".

### 6. `src/components/editor/VirtualControllerHub.tsx` — Add module card

Add new card: `{ id: 'ifmx-i32q-module', name: 'IFMx-i32Q Module', type: 'module', description: 'Turn this device into a virtual field module' }`.

## Files Summary

| File | Change |
|------|--------|
| `src/lib/fireoneModuleEmulator.ts` | NEW — Protocol emulator with 32-ch state machine |
| `src/lib/fireoneModuleHardwareBridge.ts` | NEW — ESP32 bridge (BLE/USB/WebSocket) |
| `src/components/editor/live-firing/VirtualIFMx32QPanel.tsx` | NEW — Full module replica UI |
| `src/hooks/useFireOneModuleMode.ts` | NEW — Module mode React hook |
| `src/components/editor/LiveFiringPanel.tsx` | Add 'module' mode routing |
| `src/components/editor/VirtualControllerHub.tsx` | Add IFMx-i32Q module card |
| `src/components/editor/live-firing/types.ts` | Add 'module' to FXCMode |

