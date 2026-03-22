

# Melhoramentos Identificados — Correções e Refinamentos

## Falhas Encontradas

### CRÍTICAS

**1. TDMA slots de 1.8ms são impossíveis no browser**
`setTimeout` tem resolução mínima de ~4ms em browsers. O `executeFrame()` usa `await new Promise(r => setTimeout(r, 1.8))` que na prática espera ~4-5ms por slot. Com 50 slots, o frame real leva ~200-250ms em vez de 100ms. Slots se sobrepõem com o próximo `setInterval(100ms)`.

**2. E-STOP via TDMA não é imediato**
`queueEstop()` coloca o pacote na fila do slot 0, mas **espera o próximo frame** (até 100ms). Isso viola o requisito de < 2ms. E-STOP precisa de bypass imediato do scheduler.

**3. Conflito de opcode: `PRIORITY_DISABLE = 0x70` vs `TDMA_SYNC = 0x70`**
`fireoneProtocol.ts` define `PRIORITY_DISABLE = 0x70` e `radioProtocol.ts` define `TDMA_SYNC = 0x70`. Mesmo byte = ambiguidade no parser.

**4. CellularTransport ping loop vaza memória**
`startPingLoop()` cria `setInterval` sem guardar referência. Em `disconnect()`, o interval continua rodando indefinidamente.

### MODERADAS

**5. RadioTransport.send() duplica lógica CRC**
Reimplementa CRC16 e packet building inline em vez de usar `buildRadioPacket()` do `radioProtocol.ts`.

**6. WiFiTransport.send() ainda mede buffer time local**
Mesmo bug que foi corrigido no Starlink — mede `performance.now()` ao redor de `ws.send()` que é ~0ms.

**7. `packetLossRate` calculado incorretamente**
`TransportHealthMonitor` calcula `consecutiveFailures / latencyHistory.length` — não reflete taxa de perda real. Deveria rastrear success/fail ratio.

**8. useRadioLink TDMA status nunca atualiza**
Após `enableTDMA()`, o estado `tdmaStatus` nunca é re-polled. O UI mostra valores estáticos.

**9. StarlinkTransport calibrateBaseline race condition**
Coleta latência com `setTimeout(2000)` após cada ping, mas o pong pode não ter chegado ainda.

## Plano de Correção

### Arquivo 1: `src/lib/radioProtocol.ts`
- Mudar `TDMA_SYNC` para `0x74` e `TDMA_SLOT_ASSIGN` para `0x75` (evitar conflito com `PRIORITY_DISABLE`)
- Refatorar `executeFrame()`: usar `performance.now()` busy-wait loop em vez de `setTimeout` para slots sub-4ms
- Proteger contra frame overlap: flag `_executing` que bloqueia reentrada
- Adicionar `sendEstopImmediate()` que bypassa o scheduler e envia direto via `sendFn` (latência real < 2ms)

### Arquivo 2: `src/lib/fireoneTransport.ts`
- **RadioTransport.send()**: substituir CRC inline por `wrapProtocolFrame()` importado
- **CellularTransport**: guardar referência do ping interval, limpar em `disconnect()`
- **WiFiTransport.send()**: remover medição de buffer time, usar ping/pong RTT (como Starlink)

### Arquivo 3: `src/lib/hybridTransportRouter.ts`
- **TransportHealthMonitor**: rastrear `totalSuccess` + `totalFailure` para cálculo real de packet loss
- **StarlinkTransport.calibrateBaseline()**: usar Promise-based collection em vez de setTimeout race
- **broadcastEstop()**: chamar `TDMAScheduler.sendEstopImmediate()` quando TDMA ativo

### Arquivo 4: `src/hooks/useRadioLink.ts`
- Adicionar polling interval (100ms) para `tdmaStatus` enquanto TDMA ativo
- Limpar interval no `disableTDMA()` e unmount

## Detalhes Técnicos

```text
TDMA Timing Fix:
  BEFORE: setTimeout(1.8ms) → real ~4-5ms → 50 slots = 200-250ms
  AFTER:  performance.now() busy-wait → real ~1.8ms → 50 slots = 90ms

E-STOP Bypass:
  BEFORE: queueEstop() → wait up to 100ms for next frame
  AFTER:  sendEstopImmediate() → direct sendFn() → latency < 2ms

Opcode Conflict Fix:
  PRIORITY_DISABLE = 0x70 (fireoneProtocol.ts — unchanged)
  TDMA_SYNC        = 0x74 (was 0x70 — CHANGED)
  TDMA_SLOT_ASSIGN = 0x75 (was 0x71 — CHANGED)
```

