

# IFMx-i32Q — Correção de Bugs, Modos de Disparo e Design de Hardware

## Bugs Identificados

| Bug | Localização | Impacto |
|-----|-------------|---------|
| `onFire` callback no hook NÃO reconecta ao bridge quando conectado após powerOn | `useFireOneModuleMode.ts:62-76` | Se conectar hardware DEPOIS de ligar módulo, disparos ficam em modo simulação |
| `fireGroup` no emulador executa em paralelo (`Promise.all`) — descarga CDS simultânea pode causar queda de tensão irreal | `fireoneModuleEmulator.ts:236-238` | Disparo simultâneo de 32 canais sem controle de corrente |
| Bridge `fire()` retorna `Promise<boolean>` mas `sendCommand` não espera confirmação do hardware | `fireoneModuleHardwareBridge.ts:177-180` | Fire retorna `true` antes do hardware confirmar disparo |
| E-STOP no emulador volta para `ready` ao invés de `idle` — deveria desligar fire power E parar carregamento | `fireoneModuleEmulator.ts:179-188` | E-STOP permite re-armar imediatamente (perigoso) |
| `buildStatusResponse` usa bitshift `>>` em JavaScript que trunca em 32 bits — funciona, mas `mask` usa `\|=` sem `>>>` — pins 31 overflow signed | `fireoneModuleEmulator.ts:416-418` | Pin 31 pode mostrar continuidade invertida |
| Panel UI não atualiza `bridgeStatus` após conectar — só atualiza em eventos | `VirtualIFMx32QPanel.tsx` | Badge mostra "SIM" mesmo após conexão bem-sucedida |

## Modos de Disparo Faltantes (per Manual)

O IFMx-i32Q real suporta 4 modos de disparo que não estão implementados:

1. **Manual** — Toque individual por pin (já existe, mas sem confirmação visual estilo XLII+)
2. **Semi-Auto** — Disparo por eventos (groups de cues), step-by-step, controlado pelo master
3. **Auto (Timecode)** — Script pré-carregado com tempos absolutos, auto-fire sincronizado
4. **UltraFire** — Script baixado para o módulo, executa independente do master
5. **Preset** — Seleção múltipla de pins → Fire único (parcialmente implementado)

## Melhor Hardware para Réplica Idêntica

```text
OPÇÃO RECOMENDADA: ESP32-S3 + Shift Register Chain
──────────────────────────────────────────────────────

Custo: ~$18-25 total
Vantagem: Idêntico ao IFMx real (CDS per channel)

┌─────────────┐
│  ESP32-S3   │  ← Wi-Fi + BLE + USB-C nativo
│  DevKitC-1  │  ← 44 GPIO (suficiente para controle)
└──┬──┬──┬──┬─┘
   │  │  │  │
   ▼  ▼  ▼  ▼
┌──────────────────────────────────────────┐
│  4x 74HC595 (Shift Register 8-bit)       │
│  Saída: 32 linhas digitais via 3 pinos   │
│  (DATA, CLOCK, LATCH = 3 GPIO total)     │
└──────────┬───────────────────────────────┘
           │ 32 linhas
           ▼
┌──────────────────────────────────────────┐
│  4x ULN2803A (Darlington Array 8ch)      │
│  500mA por canal, flyback diodes built-in│
└──────────┬───────────────────────────────┘
           │ 32 linhas open-collector
           ▼
┌──────────────────────────────────────────┐
│  32x 470µF 25V + 32x SCR (ou MOSFET)    │
│  CDS: Capacitive Discharge System        │
│  Cada canal: Cap → SCR Gate → E-match    │
└──────────┬───────────────────────────────┘
           │
    ┌──────┴──────┐
    │ Continuity  │  ← 2x CD4051 (8:1 MUX) + ADC
    │ Readback    │  ← Mede resistência de cada ignitor
    └─────────────┘

Alimentação: LiPo 3S 11.1V (mesmo do IFMx real)
Charge IC: TP4056 ou similar para carga USB-C
```

**Lista de componentes:**
- ESP32-S3 DevKitC ($6)
- 4x 74HC595 shift registers ($1)
- 4x ULN2803A Darlington arrays ($2)
- 32x 470µF 25V capacitors ($4)
- 32x IRFZ44N MOSFETs ou BT169 SCRs ($5)
- 2x CD4051 analog MUX para continuity ($1)
- 1x LiPo 3S 11.1V 2200mAh ($8)
- PCB custom ou protoboard ($2-5)

## Changes

### 1. `fireoneModuleEmulator.ts` — Fix bugs + add firing modes

**Bugs:**
- E-STOP → state `idle` (não `ready`), desliga fire power, zera tudo
- `fireGroup` → sequencial com 2ms delay entre canais (simula corrente real do CDS)
- `buildStatusResponse` → use `>>> 0` (unsigned shift) para pin 31
- Add `rearmDelay` após E-STOP (3s lockout per manual)

**Firing modes:**
- Add `firingMode: 'manual' | 'semi_auto' | 'auto' | 'ultrafire'` to state
- **Semi-Auto**: `loadSemiAutoScript(events[])` + `stepEvent()` — dispara próximo evento, espera comando
- **Auto**: `loadAutoScript(cues[])` + `startAutoFire()` — executa por timecode interno
- **UltraFire**: `downloadScript(slot, script)` + `runUltraFire()` — roda independente com verify code
- **Preset**: `setPreset(pins[])` + `firePreset()` — seleciona múltiplos, disparo único

### 2. `fireoneModuleHardwareBridge.ts` — Fix fire confirmation + add protocol

**Bugs:**
- `fire()` → wait for `OK:FIRE:pin` response with 2s timeout before resolving
- Add heartbeat ping every 5s to detect disconnection
- Add firmware version query on connect (`VERSION\n`)

**New commands:**
- `BATCH:mask:durationMs\n` → fire multiple via bitmask (hardware-level group fire)
- `CDS:pin\n` → read capacitor voltage (responds `CDS:pin:volts\n`)
- `HEARTBEAT\n` → responds `PONG\n`

### 3. `useFireOneModuleMode.ts` — Fix bridge reconnection + expose modes

**Bugs:**
- When bridge connects AFTER powerOn, update emulator callbacks dynamically
- Add `bridgeStatus` polling interval (1s) to keep UI in sync
- Track `firingMode` in hook state

**New:**
- Expose `setFiringMode()`, `loadScript()`, `stepEvent()`, `startAutoFire()`, `firePreset()`

### 4. `VirtualIFMx32QPanel.tsx` — Fix UI bugs + add mode selector + hardware design tab

**Bugs:**
- Update `bridgeStatus` after connect actions (await + setBridgeStatus)
- Add visual E-STOP lockout timer (3s countdown)

**Firing mode UI:**
- Mode selector tabs: Manual | Semi-Auto | Auto | UltraFire
- Semi-Auto: event list with step button, current event highlight
- Auto: timecode display, start/stop, progress bar
- UltraFire: slot selector (1-8), download progress, verify code display

**Hardware tab:**
- Schematic diagram (ASCII/SVG) of ESP32 + 74HC595 + ULN2803 + CDS
- Component checklist with links
- Firmware upload instructions
- Pin mapping table (ESP32 GPIO → Shift Register → ULN2803 → Igniter)

## Files

| File | Change |
|------|--------|
| `src/lib/fireoneModuleEmulator.ts` | Fix E-STOP, fireGroup, bitshift; add 4 firing modes + script engine |
| `src/lib/fireoneModuleHardwareBridge.ts` | Fix fire confirmation, add heartbeat, batch fire, CDS read |
| `src/hooks/useFireOneModuleMode.ts` | Fix bridge reconnection, expose firing modes |
| `src/components/editor/live-firing/VirtualIFMx32QPanel.tsx` | Fix bridgeStatus sync, add mode tabs, hardware schematic tab |

