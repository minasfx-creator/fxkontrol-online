

# Revisão, Correção e Implantação — Wi-Fi Direct + AES-128

## Gaps Encontrados na Revisão

### Gap 1: `wifi_direct` ausente do menu de navegação
`LiveFiringPanel.tsx` linha 351 — `SWIPE_MODES` **não inclui** `wifi_direct`.
Linhas 904-921 — os tabs de modo **não listam** `wifi_direct`. O usuário não consegue acessar o painel pelo menu.

### Gap 2: AES-128 não implementado
`src/lib/fireoneAesCrypto.ts` **não existe**. Nenhuma criptografia nos frames enviados via Wi-Fi Direct.

### Gap 3: `connectWiFiDirect` no protocolo não suporta PSK
`fireoneProtocol.ts` linha 661 — `connectWiFiDirect(targetHost?)` não aceita `psk` para criptografia.

### Gap 4: Scan timeout muito curto
`scanDevices()` usa timeout de 3s (linha 254), mas o `DISCOVERY_TIMEOUT` da classe é 8s. Inconsistência — em campo, 3s pode falhar.

## Plano de Correção e Implantação

### 1. `src/components/editor/LiveFiringPanel.tsx`
- Adicionar `'wifi_direct'` ao array `SWIPE_MODES` (linha 351)
- Adicionar `{ key: 'wifi_direct', label: '📡 WFD' }` ao array de mode tabs (após `connections`, ~linha 918)

### 2. `src/lib/fireoneAesCrypto.ts` — NOVO
Utilitário AES-128-GCM usando Web Crypto API nativa:
- `deriveKey(psk: string)`: PBKDF2 → AES-128 key
- `encrypt(key, data: Uint8Array)`: retorna `Uint8Array` (12-byte IV + ciphertext + tag)
- `decrypt(key, packed: Uint8Array)`: extrai IV, decifra, verifica tag
- Zero dependências externas

### 3. `src/lib/fireoneWifiDirectTransport.ts` — Integrar AES
- Adicionar campo `encryptionKey?: CryptoKey`
- No `connect(config)`: se `config.psk` presente, derivar key via `deriveKey()`
- No `send()`: se key ativa, encriptar frame antes de enviar
- No `onmessage` (binary): se key ativa, decriptar antes de notificar callbacks
- Scan timeout: aumentar de 3s para 5s no `scanDevices()`
- Backward compatible: sem PSK = sem criptografia

### 4. `src/hooks/useFireOneHardware.ts` — PSK no connectWiFiDirect
- `connectWiFiDirect(targetHost?: string, psk?: string)` — repassa PSK para o transporte

### 5. `src/lib/fireoneProtocol.ts` — PSK no controller
- `connectWiFiDirect(targetHost?: string, psk?: string)` — passa `{ targetHost, psk }` ao `connect()`

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/editor/LiveFiringPanel.tsx` | Add `wifi_direct` ao SWIPE_MODES + mode tabs |
| `src/lib/fireoneAesCrypto.ts` | NOVO — AES-128-GCM via Web Crypto API |
| `src/lib/fireoneWifiDirectTransport.ts` | Integrar AES encrypt/decrypt + fix scan timeout |
| `src/hooks/useFireOneHardware.ts` | Add PSK param ao connectWiFiDirect |
| `src/lib/fireoneProtocol.ts` | Add PSK param ao connectWiFiDirect |

