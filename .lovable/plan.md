# Plano — Conectividade Real e Descoberta Unificada de Hardware

## Objetivos
1. Acesso a **todas as portas** já autorizadas pelo navegador (sem novo clique a cada sessão).
2. Permitir saída DMX em **adapters genéricos (FTDI/CH340)** mediante confirmação explícita do operador.
3. Substituir a `DeviceDiscovery` simulada por **descoberta real**: WebSerial + WebUSB + Web Bluetooth + mDNS (Art-Net).
4. **Hot-plug** real: detectar plug/unplug e reabrir portas automaticamente.
5. Refinar UI do `USBConnectionPanel` e `HardwareOverview` para refletir a realidade do barramento.

---

## 1. Camada de Descoberta Real (`src/core/discovery/`)

Novo módulo com adapters por transporte, todos implementando uma interface comum:

```ts
interface TransportDiscoverer {
  id: 'webserial' | 'webusb' | 'webble' | 'mdns-artnet';
  isSupported(): boolean;
  scan(): Promise<DiscoveredDevice[]>;       // varredura ativa
  watch(cb: (ev: DiscoveryEvent) => void): () => void; // hot-plug
}
```

### 1a. `WebSerialDiscoverer.ts`
- `navigator.serial.getPorts()` lista portas **já autorizadas** (sem prompt).
- Listeners `navigator.serial.addEventListener('connect'|'disconnect', ...)` para hot-plug real.
- Cada porta retorna `{ usbVendorId, usbProductId }` → cruzar com `DEVICE_PROFILES` para identificar família (ENTTEC, DMXKing, FTDI, CH340, CP210x, Showven).
- Para portas conhecidas no histórico, marca como **auto-reconnectable**.

### 1b. `WebUsbDiscoverer.ts`
- `navigator.usb.getDevices()` para devices raw (não-serial, ex.: ENTTEC DMX USB Pro Mk2 em modo bulk).
- Eventos `connect`/`disconnect` em `navigator.usb`.
- Filtro VID/PID para dispositivos conhecidos do show (firing controllers WebUSB-only).

### 1c. `WebBleDiscoverer.ts`
- `navigator.bluetooth.getDevices()` (Chrome 85+) para PyroMote BLE / Tuya BLE Mesh já pareados.
- `requestDevice()` com filtros por service UUID (Tuya, Nordic UART) sob clique do operador.
- Watcher de `gattserverdisconnected` por device.

### 1d. `MdnsArtnetDiscoverer.ts`
- mDNS puro não existe no browser; alternativa: **ArtPoll broadcast** via edge function existente `_shared/artnet` + WebRTC Data Channel para receber respostas (Art-Net usa UDP 6454).
- Como fallback navegador-only: ping HTTP em IPs comuns (`/24` da rede local) procurando endpoints conhecidos (ENTTEC ODE, DMXking eDMX) — opcional, atrás de toggle.
- Listar nodes Art-Net com `{ ip, shortName, longName, oem, portCount }`.

### 1e. `UnifiedDiscoveryService.ts`
- Orquestra os 4 discoverers em paralelo, deduplica por `(transport, vid, pid)` ou `(ip, mac)`.
- Emite eventos `discovered`, `lost`, `updated` num único stream.
- Substitui `src/core/hardware/DeviceDiscovery.ts` (mantém API `scan()` / `getResults()` / `onChange()` para compatibilidade com `HardwareOverview.tsx`).

---

## 2. Persistência de Autorizações (`src/core/discovery/portRegistry.ts`)

- Ao primeiro pareamento bem-sucedido, salvar em `localStorage` o snapshot `{ vid, pid, lastLabel, profileId, dmxAdapterKind, userConfirmedGeneric }`.
- Ao boot da plataforma, chamar `getPorts()` + `getDevices()` e cruzar com o registry para **reabrir automaticamente** portas que o navegador ainda autoriza (sem prompt).
- Nunca persiste a `SerialPort` em si (impossível) — só metadados e flags de confirmação.

---

## 3. Adapters Genéricos com Confirmação (UX)

### 3a. Mudança em `src/lib/dmxAdapterRecognition.ts`
- `generic-dmx` continua existindo, mas adiciona campo `requiresOperatorConfirmation: true`.

### 3b. Mudança em `src/store/useUSBDeviceStore.ts`
- Novo campo `operatorConfirmedGeneric: boolean` por device.
- `outputReady` agora é:
  ```
  type === 'dmx' && authorized && stateConnected &&
  (recognized || operatorConfirmedGeneric)
  ```
- Nova ação `confirmGenericAdapter(deviceId, asMode: 'open' | 'pro')` que:
  - Marca a flag,
  - Persiste no `portRegistry` (auto-confirmar nas próximas sessões deste VID/PID),
  - Emite log de auditoria (`logger.warn` + entrada em `_eventLog` da `UnifiedHardwareRegistry`).

### 3c. UI em `USBConnectionPanel.tsx`
- Quando `adapter.recognized === false` e device está conectado:
  - Mostrar bloco amber "Adapter genérico detectado (FTDI 0x0403:0x6001)".
  - Botão **Hold-to-Confirm 3s** (padrão Live Mode do projeto): "Confirmo que este adapter é DMX-Open. Assumo o risco."
  - Após confirmar, libera "Enviar Frame DMX Test".
  - Toggle entre modo **Open DMX** (250000 8N2) e **ENTTEC Pro** (57600 8N1) — operador escolhe e a porta é reaberta com a config certa.

---

## 4. Hot-Plug + Auto-Reconnect

### 4a. `src/lib/usbEngine.ts`
- Novo helper `attachHotPlugListeners(onConnect, onDisconnect)` que registra listeners em `navigator.serial` e `navigator.usb`.
- Quando porta autorizada reconecta fisicamente:
  - Reabre com o último `profile` usado,
  - Reinicia read loop,
  - Restaura device no `useUSBDeviceStore`,
  - Toast: "✓ ENTTEC reconectado automaticamente".
- Quando desconecta fisicamente:
  - Marca `state: 'disconnected'`, mantém entrada no store por 30s para reconnect rápido,
  - Após 30s sem replug, remove.

### 4b. Integração no `USBConnectionPanel`
- Effect monta listeners no mount; cleanup no unmount.
- Indicador visual (LED amber pulsante) quando aguardando reconnect.

---

## 5. Refinos no `HardwareOverview.tsx`
- Substituir chamada `deviceDiscovery.scan()` simulada pelo `unifiedDiscovery.scan()` real.
- Mostrar 4 colunas de descoberta: **Serial / USB / BLE / Art-Net**, cada uma com contagem e LED de status.
- Botão "ENABLE DEEP SCAN" que dispara WebUSB raw + ArtPoll broadcast (precisa clique de usuário).
- Tabela enriquecida: `[Transport] [VID:PID] [Família] [Reconhecido?] [Autorizado?] [DMX-ready?]`.

---

## 6. Honest Hardware Layer — atualização de regra
- Memória `mem://funcionalidades/honest-hardware-layer` será atualizada para refletir o novo princípio:
  > "Adapters não reconhecidos podem transmitir DMX **somente após confirmação explícita do operador (Hold-to-Confirm)**, registrada em log de auditoria e persistida por VID/PID."

---

## 7. Arquivos afetados

**Novos**
- `src/core/discovery/types.ts`
- `src/core/discovery/WebSerialDiscoverer.ts`
- `src/core/discovery/WebUsbDiscoverer.ts`
- `src/core/discovery/WebBleDiscoverer.ts`
- `src/core/discovery/MdnsArtnetDiscoverer.ts`
- `src/core/discovery/UnifiedDiscoveryService.ts`
- `src/core/discovery/portRegistry.ts`
- `src/components/editor/usb/GenericAdapterConfirm.tsx` (Hold-to-Confirm)
- `src/components/editor/hardware/DiscoveryGrid.tsx`

**Editados**
- `src/lib/usbEngine.ts` (hot-plug helpers, getPorts wrapper)
- `src/lib/dmxAdapterRecognition.ts` (`requiresOperatorConfirmation`)
- `src/store/useUSBDeviceStore.ts` (`operatorConfirmedGeneric`, `confirmGenericAdapter`, lógica `outputReady`)
- `src/components/editor/USBConnectionPanel.tsx` (UI confirm, hot-plug indicators)
- `src/components/editor/HardwareOverview.tsx` (DiscoveryGrid integration)
- `src/core/hardware/DeviceDiscovery.ts` (passa a ser fachada sobre `UnifiedDiscoveryService`)
- `mem://funcionalidades/honest-hardware-layer` + `mem://index.md`

---

## 8. Garantias mantidas (não-negociáveis)
- ✅ Nenhum frame DMX é enviado sem **clique humano** em adapter genérico.
- ✅ Toda confirmação fica em log auditável (Black Box 100ms compatível).
- ✅ Read-only mode continua bloqueando comandos (apenas descoberta opera em qualquer modo).
- ✅ E-STOP <50ms preservado (descoberta roda em microtasks, fora do hot-path).
- ✅ Memory: todos os listeners têm cleanup; portRegistry tem cap de 50 entries com LRU.