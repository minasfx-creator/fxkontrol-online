

# Revisão Final: Gaps e Melhorias — Controle Real XL4/XL2 + FM-i32Q via Wi-Fi Direct

## Gaps Críticos Encontrados

### Gap 1: Dois sistemas de comunicação isolados — sem ponte
- **`FireOneHardwareBridge`** (módulo direto) fala protocolo **texto** (`FIRE:pin:dur\n`)
- **`TransportManager`** + `FireOneController` falam protocolo **binário RS-485** (`[STX][ADDR][CMD]...`)
- O plano anterior cria `WiFiDirectTransport` para o TransportManager mas **não define como rotear frames binários RS-485 sobre WebSocket para a XL4 gateway**. O `WiFiTransport` existente já faz isso (envia `Uint8Array` binário via WS), mas usa IP/porta genéricos sem discovery mDNS.
- **Correção**: `WiFiDirectTransport` deve ser uma variante do `WiFiTransport` com auto-discovery mDNS e prioridade diferente, não uma classe totalmente nova. Reutilizar a lógica de `WiFiTransport` (send binary, receive binary) mas com endpoints de discovery P2P.

### Gap 2: `useFireOneHardware` não tem `connectWiFiDirect`
- O hook expõe `connect`, `connectWiFi`, `connectRadio`, `connectArtNet` mas **não `connectWiFiDirect`**.
- O plano diz para adicionar mas `fireoneProtocol.ts` (`FireOneController`) também não tem `connectWiFiDirect()` — precisa ser adicionado lá primeiro.

### Gap 3: `TransportType` não inclui `wifi_direct`
- `fireoneTransport.ts` line 11: `TransportType = 'serial' | 'radio' | 'wifi' | 'artnet'`
- Sem `wifi_direct`, o manager não consegue filtrar/identificar esse transporte.

### Gap 4: `ConnectionType` no Hub não inclui `wifi_direct`
- `VirtualControllerHub.tsx` line 22: `ConnectionType = 'usb' | 'artnet' | 'wireless' | 'pbus' | 'serial' | 'radio' | 'sim' | 'ble'`
- O card do XL4 lista `['usb', 'serial', 'radio']` — sem Wi-Fi Direct.

### Gap 5: Sem confirmação de segurança para hardware real
- Em contexto pirotécnico, conectar Wi-Fi Direct e disparar em hardware REAL sem dialogs de confirmação é perigoso. Nenhum componente atual tem `AlertDialog` de "MODO REAL — confirmar ARM?".

### Gap 6: Sem indicador visual REAL vs SIMULAÇÃO
- O usuário pode confundir emulação com hardware real. `VirtualIFMx32QPanel` não diferencia visualmente.

### Gap 7: Firmware gateway (WS↔RS-485) inexistente
- O firmware v2 existente (`FXK_ESP32S3_Firmware_v2.ino`) é para módulo direto (interpreta FIRE/CONT). Falta firmware de **bridge transparente** para acoplar à XL4.

### Gap 8: E-STOP não é broadcast em Wi-Fi Direct
- `TransportManager.broadcast()` envia em todos os transportes conectados, mas se Wi-Fi Direct não está registrado lá, E-STOP não alcança a XL4 gateway.

## Melhorias Adicionais

1. **Latência de rede visível**: Mostrar ping em ms ao lado do indicador RSSI na UI
2. **Timeout de conexão configurável**: Wi-Fi Direct em campo pode ter latência maior — timeout de 3s é agressivo, usar 8s
3. **Fallback chain documentada**: Se Wi-Fi Direct falha, cair para Wi-Fi AP automaticamente (ambos são WebSocket)
4. **Dual-mode simultâneo**: Permitir conectar XL4 gateway E módulo direto ao mesmo tempo (show híbrido com módulos independentes + módulos na rail da XL4)

## Plano Revisado Final

### 1. `src/lib/fireoneWifiDirectTransport.ts` — NOVO
Classe `WiFiDirectTransport extends WiFiTransport` (reutiliza lógica binária):
- Override `connect()` com auto-discovery: tenta `ws://fxk-xl4.local:81`, `ws://fxk-fm.local:81`, `ws://192.168.4.1:81`
- `type: 'wifi_direct'`, `priority: 1.5` (entre serial e wifi)
- Timeout de 8s para discovery
- STATUS polling inclui RSSI do gateway

### 2. `src/lib/fireoneTransport.ts` — Tipo atualizado
- `TransportType = 'serial' | 'radio' | 'wifi' | 'wifi_direct' | 'artnet'`

### 3. `src/lib/fireoneProtocol.ts` — Novo método `connectWiFiDirect`
```typescript
async connectWiFiDirect(targetHost?: string): Promise<string> {
  const wd = new WiFiDirectTransport();
  this.transportManager.addTransport(wd);
  await wd.connect({ targetHost });
  return wd.id;
}
```

### 4. `src/hooks/useFireOneHardware.ts` — Expor `connectWiFiDirect`
- Novo `connectWiFiDirect` callback que chama `controller.connectWiFiDirect()`
- Retornado no objeto do hook

### 5. `src/components/editor/VirtualControllerHub.tsx` — Cards atualizados
- Adicionar `'wifi_direct'` ao `ConnectionType`
- XL4 card: `connectionTypes: ['usb', 'serial', 'radio', 'wifi_direct']`
- FM-i32Q card: já tem `wifi_direct` via bridge, adicionar badge "REAL" quando `wifi_direct` ativo
- Ícone `Antenna` (ou `Radio` com cor diferente) para `wifi_direct`

### 6. `src/components/editor/live-firing/WiFiDirectControlPanel.tsx` — NOVO
Painel com 3 seções:
- **Discovery**: scan automático, lista dispositivos (SSID, tipo XL4/FM, RSSI)
- **Gateway XL4**: ARM/DISARM/E-STOP reais, módulos online, bateria
- **FM-i32Q Direto**: grid 32 ignitores com continuidade real
- **Safety**: `AlertDialog` obrigatório antes de ARM ("HARDWARE REAL — confirmar?")
- Indicador de latência + RSSI + badge "REAL" pulsante

### 7. `src/components/editor/live-firing/VirtualIFMx32QPanel.tsx` — Toggle REAL
- Badge "MODO REAL" com borda vermelha pulsante quando bridge conectado
- `AlertDialog` antes de ARM/FIRE em modo real
- Indicador visual claro (fundo vermelho sutil) diferenciando de simulação

### 8. `/mnt/documents/FXK_XL4_Gateway_Firmware.ino` — Firmware bridge
ESP32 acoplado à XL4:
- Wi-Fi AP: `FXK-XL4` / `fireworks32`
- mDNS: `fxk-xl4.local`
- WebSocket server porta 81 (binary mode)
- UART TX/RX → RS-485 transceiver → barramento da XL4
- Bidirecional transparente: WS binary ↔ UART
- Heartbeat watchdog: 10s sem dados → safety cutoff
- STATUS: inclui RSSI cliente, uptime, UART health

## Arquivos

| Arquivo | Mudança |
|------|--------|
| `src/lib/fireoneWifiDirectTransport.ts` | NOVO — WiFiDirectTransport com mDNS discovery |
| `src/lib/fireoneTransport.ts` | Add `'wifi_direct'` ao TransportType |
| `src/lib/fireoneProtocol.ts` | Add `connectWiFiDirect()` ao controller |
| `src/hooks/useFireOneHardware.ts` | Expor `connectWiFiDirect()` |
| `src/components/editor/VirtualControllerHub.tsx` | `wifi_direct` ConnectionType + badge REAL |
| `src/components/editor/live-firing/WiFiDirectControlPanel.tsx` | NOVO — painel controle real |
| `src/components/editor/live-firing/VirtualIFMx32QPanel.tsx` | Badge MODO REAL + safety dialogs |
| `/mnt/documents/FXK_XL4_Gateway_Firmware.ino` | Firmware bridge WS↔RS-485 |

