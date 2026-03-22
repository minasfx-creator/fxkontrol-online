

# Correção, Refinamento e Implementação — Falhas Encontradas

## Falhas Críticas Identificadas

### 1. E-STOP CMD Mismatch (SEGURANÇA)
`hybridTransportRouter.ts` usa `ESTOP_CMD = 0x45` ('E'), mas `fireoneProtocol.ts` define `EMERGENCY_STOP = 0x58` ('X'). Isso significa que o router **nunca classifica um E-STOP real corretamente** — comandos de emergência seriam roteados como prioridade `normal` em vez de `broadcast`.

### 2. CellularTransport não implementado
O plano aprovado para transporte via rede celular (4G/LTE/5G) nunca foi codificado. Não existe `CellularTransport` nem `TransportType = 'cellular'`.

### 3. TDMA não implementado
O plano aprovado para TDMA (Time Division Multiple Access) no `radioProtocol.ts` para eliminar colisões RF em 50+ módulos nunca foi codificado.

### 4. hybridTransportRouter não conhece 'cellular'
O routing matrix não inclui o path celular como opção de supervisão/fallback.

### 5. Unused constants
`radioProtocol.ts` declara `MAX_RETRIES`, `RETRY_BACKOFF_MS`, `ACK_TIMEOUT_MS` mas nunca os usa — sem retry real no protocolo.

### 6. `parseRadioResponse` silently drops corrupted frames
CRC fail retorna `null` sem logging — frames corrompidos são invisíveis para debug.

### 7. StarlinkTransport.send() mede latência incorretamente
Mede apenas o tempo de `ws.send()` (buffer local ~0ms), não o round-trip real.

## Plano de Implementação

### Arquivo 1: `src/lib/radioProtocol.ts` — TDMA Engine
- Adicionar `RadioCmd.TDMA_SYNC = 0x70`, `TDMA_SLOT_ASSIGN = 0x71`
- Implementar `TDMAScheduler` class:
  - Frame de 100ms, 50 slots de 1.8ms, guard interval 10ms
  - Slot 0 reservado para E-STOP broadcast (latência < 2ms)
  - Slot assignment por endereço do módulo
  - Sync beacon no guard interval para alinhamento de clock
  - Queue de pacotes por slot com overflow handling
- Adicionar retry com backoff usando as constantes existentes
- Export `TDMAScheduler`, `TDMAConfig`, `TDMASlotAssignment`

### Arquivo 2: `src/lib/fireoneTransport.ts` — CellularTransport
- Adicionar `'cellular'` ao `TransportType` union
- Implementar `CellularTransport` class:
  - WebSocket sobre rede de dados móvel via relay server
  - Detecta tipo de conexão via `navigator.connection` API (4G/LTE/5G)
  - Monitora qualidade: effectiveType, downlink, rtt
  - Auto-reconnect com backoff exponencial
  - Priority = 2.5 (entre Wi-Fi Direct e Radio)
  - Health reporting: signal quality, network type

### Arquivo 3: `src/lib/hybridTransportRouter.ts` — Correções + Cellular
- **FIX CRITICAL**: Corrigir `ESTOP_CMD` de `0x45` para `0x58` (alinhado com `fireoneProtocol.ts`)
- Adicionar `'cellular'` ao `RoutingPath` type
- Integrar cellular como path de supervisão (junto com starlink)
- Atualizar `getTransportsByPath()` para incluir cellular
- Fix latência do StarlinkTransport: usar ping/pong RTT em vez de buffer time

### Arquivo 4: `src/hooks/useRadioLink.ts` — Expor TDMA
- Adicionar estado TDMA ao `RadioLinkState`
- Expor `enableTDMA()`, `disableTDMA()`, `getTDMAStatus()`
- Integrar TDMAScheduler com o sendRaw existente

## Detalhes Técnicos

```text
TDMA Frame Structure (100ms):
┌──────┬──────┬──────┬─────┬──────┬──────────┐
│Slot 0│Slot 1│Slot 2│ ... │Slot49│Guard+Sync│
│E-STOP│Mod 1 │Mod 2 │     │Mod49 │  Beacon  │
│ 1.8ms│ 1.8ms│ 1.8ms│     │ 1.8ms│   10ms   │
└──────┴──────┴──────┴─────┴──────┴──────────┘

CellularTransport Path:
  Mobile (4G/5G) → WSS relay → Edge Function → Module
  Classified as 'supervision' — E-STOP NEVER routes only via cellular

E-STOP CMD Fix:
  BEFORE: ESTOP_CMD = 0x45 (WRONG — 'E' = não é E-STOP real)
  AFTER:  ESTOP_CMD = 0x58 (CORRECT — 'X' = FireOneCmd.EMERGENCY_STOP)
```

