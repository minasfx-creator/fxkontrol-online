

# Firmware ESP32 Gateway com AES-128-GCM — FXK_XL4_Gateway_Firmware.ino

## Objetivo

Gerar firmware completo para ESP32 que atua como bridge transparente WebSocket ↔ RS-485, com suporte a descriptografia AES-128-GCM dos frames recebidos do app FX Kontrol.

## Funcionalidades do Firmware

1. **Wi-Fi AP**: SSID `FXK-XL4` / senha `fireworks32`
2. **mDNS**: `fxk-xl4.local` para auto-discovery
3. **WebSocket server** porta 81 (binary mode)
4. **AES-128-GCM decrypt**: mesma derivação PBKDF2 do `fireoneAesCrypto.ts` (salt `FireOne-WFD-AES128`, 100k iterações, SHA-256)
5. **UART bridge**: TX/RX → RS-485 transceiver → barramento XL4
6. **Bidirecional**: WS binary (decrypt) → UART TX; UART RX → WS binary (encrypt)
7. **Safety watchdog**: 10s sem heartbeat → desabilita UART TX
8. **STATUS response**: RSSI cliente, uptime, UART health, encryption status
9. **Heartbeat**: responde `pong` com timestamp para cálculo de latência

## Especificações Técnicas

- Plataforma: ESP32-S3 (Arduino framework)
- Bibliotecas: `WiFi.h`, `WebSocketsServer.h`, `ESPmDNS.h`, `mbedtls/gcm.h` (nativa no ESP32)
- PSK hardcoded (configurável via `#define`) — mesma chave usada no app
- Wire format idêntico ao `fireoneAesCrypto.ts`: `[12-byte IV][ciphertext + 16-byte GCM tag]`
- Derivação de chave via PBKDF2-SHA256 no boot (uma vez)

## Arquivo Gerado

| Arquivo | Descrição |
|---------|-----------|
| `/mnt/documents/FXK_XL4_Gateway_Firmware.ino` | Firmware completo Arduino IDE ready |

