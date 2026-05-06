
# FX KONTROL — Integração Total + Disparos Reais · Plano v3 (final)

Esta revisão fecha o **gap mais grave** descoberto auditando o command path real:

> `uiCommandGateway.fire()` faz `commandBus.dispatch({ type:'FIRE', payload })` — **mas nenhum consumidor escuta `'FIRE'` no commandBus**. O único caminho que chega ao hardware hoje é `executionBridge → pyroExecutor.fire(cue, fieldBus)`, e `fieldBus` tem **3 transports stub** (`send: () => false`) sem nenhuma rotina de write real registrada. Resultado: hoje não dispara nada de verdade — o app está honesto sobre isso (retorna `false` + buffer offline), mas precisa de fechamento ponta-a-ponta.

O v3 mantém todo o que já foi planejado (discovery/bridge/UI da matriz JOI) **e** adiciona o fechamento do circuito de comando até as portas físicas.

---

## 0. Princípios invioláveis (inalterados)

- ShowPlan = fonte canônica.
- Caminho único: `UI → uiCommandGateway → commandBus → SafetyStateMachine → FieldBus → real transport`. **Toda a v3 só preenche os elos vazios** desse caminho — não cria atalho novo.
- Honest hardware: nenhum estado sintético; provenance só sobe a `live_read_only` após handshake real.
- BLE banido para pyro em `real_operation` (`pyroTransportPolicy`).
- E-STOP `<50ms` via `GlobalEStopButton` (mantido).
- `_quarantine/safety` intocado; `productionSafetyOath` + `safetyBlackBox` continuam mandatórios.
- IA jamais arma/dispara/muda workMode (`aiGuardrail`).

---

## 1. Discovery e Bridge (cabo + wireless) — do v2

Mantido na íntegra:

- **EDIT** `controllerRegistry.ts`: famílias novas `arduino-nano`, `fireone-cable`, `fireone-radio` com regex.
- **NEW** `FireOneRadioDiscoverer.ts`: Web Serial 38400 8N1 do dock TNC USB-RF, classifica `family:'fireone-radio'`, broadcast `IDENTIFY 0xFF` para enumerar os módulos wireless e popular `wirelessChildren:[{addr,rssi,ch}]`.
- **EDIT** `UnifiedDiscoveryService.ts`: registra o novo discoverer.
- **EDIT** `discoveryRegistryBridge.ts`: 3 watchers novos (Nano + cable + radio) com fan-out piggy-back para os 4 sub-adapters do Nano (Battery / Mux / SR / RelayBank32). Cada attach/detach grava `safetyBlackBox.recordSafetyNote('hw-attach' | 'hw-detach', …)`.

---

## 2. Caminho de comando real — fechamento dos 2 elos vazios

### 2.1 NEW `src/core/command/commandFireRouter.ts`
Único consumidor de `commandBus.on('FIRE', …)` no app. Resolve o cue alvo a partir do payload (`{ cueId }` ou `{ moduleAddress, channel, duration, effectId }`), valida com `safetyStateMachine.canFire()` e delega:

```ts
commandBus.on('FIRE', (cmd) => {
  // 1. Verdict (já cobre productionSafetyOath + planHash + Phase2 + transportPolicy)
  const verdict = evaluatePyroDispatchVerdict(cmd.payload);
  if (verdict.outcome !== 'allow') {
    safetyBlackBox.recordSafetyNote('fire-blocked', verdict);
    return;
  }
  // 2. Resolve cue (one-shot manual fire OR scheduled cue lookup)
  const cue = resolvePyroCue(cmd.payload);
  // 3. Single delegation point — same path executionBridge already uses
  pyroExecutor.fire(cue, fieldBus);
});
```

Com isso o `uiCommandGateway.fire()` finalmente leva a um disparo real — sem inventar caminho novo.

### 2.2 EDIT `src/core/network/fieldBus.ts`
Adiciona método público (faltante) `setTransport(id: TransportId, impl: Pick<Transport,'send'|'isAlive'>)` e `heartbeat(id)`. Nada mais muda no roteamento existente (failover wifi → rs485 → relay).

### 2.3 NEW `src/core/network/realTransports.ts`
Implementações reais que chamam o que já existe — sem duplicar protocolo:

```ts
// 'wifi'   → Art-Net UDP via supabase edge `artnet-bridge` (já presente)
fieldBus.setTransport('wifi', {
  send: msg => artnetBridge.sendDmx(msg.payload.universe, msg.payload.bytes),
  isAlive: () => artnetBridge.isHealthy(),
});

// 'rs485'  → FireOne cable XLII+ via FireOnePanel link (Web Serial 9600 8N1)
fieldBus.setTransport('rs485', {
  send: msg => fireOneCableLink.send(buildFire(msg.payload)),
  isAlive: () => fireOneCableLink.state === 'connected',
});

// 'relay'  → FXK16 / FireOne wireless (TNC dock 38400 ou BLE quando NÃO real_operation)
fieldBus.setTransport('relay', {
  send: msg => relayLink.send(buildFire(msg.payload)),
  isAlive: () => relayLink.state === 'connected',
});
```

`relayLink` é escolhido em ordem `serial > usb > artnet > ble` segundo `pyroTransportPolicy` para o módulo alvo (BLE é bloqueado em `real_operation` automaticamente — política já existente).

### 2.4 EDIT `discoveryRegistryBridge.ts`
Além dos `markHandshakeOk`, agora também:
- Registra senders no `transportSenderRegistry` (Web Serial / WebUSB / BLE / Art-Net) — fecha o stub `NO_REAL_SENDER` para o `MultiTransportLink`.
- Quando o handshake confirma uma família relevante (`fxk16` / `fireone-cable` / `fireone-radio` / `artnet-node`), faz `fieldBus.setTransport(...)` com o link daquele dispositivo (auto-failover continua nativo do FieldBus).
- No `markHandshakeLost` correspondente, faz `fieldBus.setTransport(id, stub)` de volta — nunca deixa um transport "morto pensando que está vivo".

---

## 3. Senders reais → `transportSenderRegistry` (do v2)

Boot do bridge registra os 4 senders reais (`webserial`, `webusb`, `webble`, `mdns-artnet`). Stub `NO_REAL_SENDER` permanece como salvaguarda honesta.

---

## 4. UI

### 4.1 NEW `src/pages/dev/HardwareIntegrationPage.tsx` (`/dev/hardware-integration`)
Matriz JOI viva (9 linhas, mesma ordem do PDF) + botão **Snapshot JSON** (output byte-idêntico ao PDF) + botão **Connect everyone** (`unifiedDiscovery.scanDeep`) + health score `100·live/9 − 5·verification.errors`.

### 4.2 NEW `src/lib/joiMatrixSnapshotter.ts`
Função pura `snapshotJoiMatrix()` que lê `unifiedHardwareRegistry.getAllSnapshots()` e produz o bloco `[JOI_MATRIX] … [JOI_STATUS]` no formato literal do PDF — reusada por essa página, por `JoiReport` e por `joiCommandExecutor.tools.get_system_state`.

### 4.3 EDIT `src/features/fieldbus/FireOnePanel.tsx`
Toggle **CABLE / WIRELESS / AUTO**. AUTO tenta cable; se 3s sem reply, cai em radio; se ambos morrem → `disconnected` (nunca fake).

### 4.4 EDIT `src/pages/FieldOps.tsx`
Pill espelho do toggle no header da aba FIREONE.

### 4.5 NEW `src/components/safety/RealFiringReadinessBadge.tsx`
Badge global (junto do `GlobalEStopButton`) mostrando:
- `READY · transport=rs485` (verde) — quando há transport vivo + Phase 2 fresco + workMode=`real_operation`.
- `SIMULATION` (cyan) — qualquer outro caso.

Lê `fieldBus.activeTransport`, `phase2.lastGrant`, `workMode.current`. Sem efeitos colaterais.

---

## 5. Safety / Provenance / Auditoria

- `evaluatePyroDispatchVerdict(payload, { planHash, cueId })` chamado em **todo** `commandBus.on('FIRE')` (já existe — só passa a ter consumidor real).
- `safetyBlackBox.recordSafetyNote('fire-dispatched' | 'fire-blocked' | 'hw-attach' | 'hw-detach', envelope)` em cada transição.
- `realOnlyGate` continua filtrando ingestão de telemetria não verificada.
- `pyroTransportPolicy.PYRO_FIRE_PRIORITY = [serial, usb, artnet]` aplicado **dentro** do `realTransports.ts` quando escolhe `relayLink`.
- Em `real_operation`: BLE rejeitado para pyro; `productionSafetyOath` + `phase2 grant ≤ 5 min` exigidos pelo `evaluatePyroDispatchVerdict` antes de qualquer `fieldBus.send`.

---

## 6. Testes (vitest)

| Spec | Cobertura |
|---|---|
| `core/command/__tests__/commandFireRouter.spec.ts` | `commandBus.dispatch('FIRE')` chama `pyroExecutor.fire` exatamente 1×; bloqueio se verdict ≠ allow; cueId resolvido corretamente; manual fire (sem cueId) também funciona. |
| `core/network/__tests__/fieldBus.setTransport.spec.ts` | `setTransport` substitui stub sem reset do contador de failover; heartbeat retoma; `setTransport(id, stub)` revoga sem fake. |
| `core/network/__tests__/realTransports.spec.ts` | wifi → artnet edge; rs485 → fireone cable; relay → preference order respeita `pyroTransportPolicy` em real_operation (BLE removido). |
| `core/discovery/__tests__/fireOneRadioDiscoverer.spec.ts` | classificação + broadcast IDENTIFY + `wirelessChildren` populado a partir de bytes mockados. |
| `core/hardware/__tests__/discoveryRegistryBridge.arduinoNano.spec.ts` | watcher Nano promove os 5 adapters de uma vez; demote idempotente; `safetyBlackBox` registrado. |
| `core/hardware/__tests__/discoveryRegistryBridge.fireone.spec.ts` | cable + radio simultâneos não duplicam handshake; só um demote quando o último some. |
| `core/discovery/__tests__/transportSenderRegistry.realSenders.spec.ts` | senders registrados → `getSender('webserial')` ≠ stub; sem registro continua stub honest. |
| `lib/__tests__/joiMatrixSnapshotter.spec.ts` | output bate com fixture do PDF (linha-a-linha) p/ adapters em estado simulado E em estado live. |
| `features/fieldbus/__tests__/FireOnePanel.transportToggle.spec.tsx` | AUTO cai pra radio após 3s sem reply do cable. |
| `core/safety/__tests__/realFiring.endToEnd.spec.ts` | em `real_operation` + Phase 2 fresco + transport vivo: `uiCommandGateway.fire(src, {cueId})` resulta em **um** byte-stream gravado no transport mock; em qualquer pré-condição faltando, **zero** bytes saem. |

Critério de aceite: 1000+ tests atuais continuam verde + os 10 novos verde.

---

## 7. Escopo de superfície

```text
NEW   ~6 arquivos    commandFireRouter, realTransports, FireOneRadioDiscoverer,
                      joiMatrixSnapshotter, HardwareIntegrationPage,
                      RealFiringReadinessBadge, +10 specs
EDIT  ~8 arquivos    discoveryRegistryBridge (3 watchers + senders +
                      setTransport calls), controllerRegistry (regex+kinds),
                      UnifiedDiscoveryService (+1 discoverer),
                      ArduinoNanoAdapter (ingestStatusLine),
                      FireOneProfileAdapter (cable/radio fields),
                      FireOnePanel (toggle), FieldOps (pill),
                      fieldBus (setTransport public method)
ZERO  mudança       uiCommandGateway, commandBus, safetyStateMachine,
                      pyroExecutor, fireoneProtocol wire, productionSafetyOath,
                      pyroTransportPolicy, GlobalEStopButton, _quarantine,
                      adapters Battery/Mux/SR/RelayBank/DMX/Art-Net APIs
```

---

## 8. Resultado esperado

**Matriz JOI** (após bridge rodar com hardware real, qualquer combinação cabo+wireless):

```text
Arduino Nano - FXK Controller       LIVE READ-ONLY | ONLINE  telemetry_verified
74HC595 x 4 - Output Expansion       LIVE READ-ONLY | ONLINE  telemetry_verified (piggy)
CD4051 x 2 - 16ch Analog MUX         LIVE READ-ONLY | ONLINE  telemetry_verified (piggy)
32ch Relay Bank - Field Output       LIVE READ-ONLY | ONLINE  telemetry_verified (piggy)
FXK16 - 16ch (ESP32-S3)              LIVE READ-ONLY | ONLINE  telemetry_verified
12V Field Battery                    LIVE READ-ONLY | ONLINE  telemetry_verified (piggy)
Art-Net Node - DMX Bridge            LIVE READ-ONLY | ONLINE  telemetry_verified
FireOne Profile  (cable + radio)     LIVE READ-ONLY | ONLINE  telemetry_verified
DMX Universe 1                       LIVE READ-ONLY | ONLINE  telemetry_verified
Health score                          ≥ 90 (de 20 → 90+)
```

**Disparos reais** (cenário real_operation autorizado):

```text
Operador toca FIRE no PyroControllerCard
  → uiCommandGateway.fire(src, {cueId:'C42'})
  → commandBus.dispatch('FIRE')
  → commandFireRouter:
       evaluatePyroDispatchVerdict(...) = allow   ✓ Phase2 + planHash + oath + policy
  → pyroExecutor.fire(cue, fieldBus)
  → fieldBus.send → activeTransport=rs485
  → realTransports['rs485'].send(buildFire(...))
  → fireOneCableLink.send(bytes)  →  FTDI → módulo XLII+ slat 1 cue 7
  → safetyBlackBox: 'fire-dispatched' { cueId, planHash, transport, latencyMs }
```

E-STOP global e pyroTransportPolicy continuam intactos.

Pronto para Approve. Após aprovação, executo na ordem **2.1 → 2.2 → 2.3 → 2.4 → 1 (discovery) → 4 → 5 → 6**.
