

# Conexão via Rádio (Antena do Celular) + Bluetooth ao Sistema IFMx-i32Q

## Situação Atual

O `fireoneModuleHardwareBridge.ts` já suporta 4 transportes: `ble`, `usb`, `websocket`, `direct_relay`. Falta:
1. **Bluetooth direto** do celular → ESP32 com protocolo de disparo (diferente do BLE genérico do `bluetoothEngine.ts` que é para DMX)
2. **Rádio via antena do celular** — celulares não têm rádio 433/868MHz nativo, mas podem usar **Wi-Fi Direct (P2P)** como "rádio" sem roteador, ou **BLE Long Range (Coded PHY)** para alcance estendido (~1km)

## Arquitetura Proposta

```text
CELULAR (FX Kontrol)
  │
  ├── Bluetooth BLE ────────── ESP32 (direto, sem pareamento prévio)
  │     └─ Coded PHY (BLE 5.0 Long Range ~1km)
  │
  ├── Wi-Fi Direct (P2P) ──── ESP32 (sem roteador, antena do celular)
  │     └─ WebSocket sobre Wi-Fi Direct
  │
  ├── Wi-Fi AP ─────────────── ESP32 AP mode (existente)
  │
  └── USB OTG ──────────────── Arduino/ESP32 (existente)
```

## Mudanças

### 1. `fireoneModuleHardwareBridge.ts` — Novos transportes

- Adicionar `BridgeTransport: 'ble_lr' | 'wifi_direct'` aos tipos existentes
- **`connectBLELongRange()`**: Usa Web Bluetooth com `optionalManufacturerData` para descobrir ESP32 FXK sem filtro de service UUID (scan aberto), depois conecta ao service FXK. Suporte a Coded PHY quando disponível via `requestDevice({ optionalServices, optionalManufacturerData })`
- **`connectWiFiDirect()`**: Scan de rede local para encontrar ESP32 via mDNS/broadcast, conecta WebSocket automaticamente. No celular: usa a antena Wi-Fi como "rádio" P2P — o ESP32 cria AP e o celular conecta diretamente sem internet
- Adicionar auto-discovery: tenta mDNS `fxk-esp32.local:81` antes de pedir URL manual
- Indicador de RSSI/distância estimada para BLE e Wi-Fi

### 2. `useFireOneModuleMode.ts` — Expor novos métodos

- `connectBLELongRange()` e `connectWiFiDirect()` no hook
- Auto-reconnect: se conexão cair, tenta reconectar 3x com backoff

### 3. `VirtualIFMx32QPanel.tsx` — UI de conexão expandida

- Seção de conexão com 5 opções visuais:
  - 📶 **BLE** (curto alcance ~30m)
  - 📡 **BLE Long Range** (até ~1km, requer BLE 5.0)
  - 📻 **Wi-Fi Direct** (antena do celular, sem roteador)
  - 🌐 **Wi-Fi AP** (ESP32 como access point)
  - 🔌 **USB OTG** (cabo direto)
- Indicador de intensidade de sinal (RSSI bars) para conexões wireless
- Badge de distância estimada
- Auto-scan ao abrir painel de conexão

### 4. Firmware ESP32-S3 atualizado

- Gerar firmware atualizado (`FXK_ESP32S3_Firmware_v2.ino`) com:
  - BLE Long Range (Coded PHY) advertisement
  - Wi-Fi AP + mDNS responder (`fxk-esp32.local`)
  - Beacon broadcast com nome/ID do módulo para discovery automático
  - Indicador de RSSI do cliente conectado no STATUS response

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/lib/fireoneModuleHardwareBridge.ts` | Add `connectBLELongRange()`, `connectWiFiDirect()`, auto-discovery |
| `src/hooks/useFireOneModuleMode.ts` | Expose new connect methods + auto-reconnect |
| `src/components/editor/live-firing/VirtualIFMx32QPanel.tsx` | Connection UI with 5 transport options + signal indicators |
| `/mnt/documents/FXK_ESP32S3_Firmware_v2.ino` | Updated firmware with BLE LR + mDNS + beacon |

