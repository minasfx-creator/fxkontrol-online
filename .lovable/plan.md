## Objetivo

Hoje `discoverModules()` despeja IDENTIFY no "melhor transporte" e o controller não guarda qual gateway (XL4 / XL2 / Wi-Fi Direct / RS-485 / 2-Wire / Art-Net) respondeu cada módulo IFXQM (IFMx-i32Q). O resultado: roster plano, módulo do XL2 some quando XL4 é prioritário, e o painel não consegue dizer "addr 7 vive sob o XL4-Gateway".

Vamos:
1. Varrer **cada transporte conectado** individualmente.
2. Etiquetar cada módulo descoberto com o `controllerId` + label de origem (XL4 / XL2 / Wi-Fi Direct / RS-485 / etc.).
3. Mostrar o roster **agrupado por controladora** no `FireOneModulesInline`.

Sem mexer em safety (uiCommandGateway / SSM / FieldBus). Read-only de discovery.

---

## Mudanças técnicas

### 1. `src/lib/fireoneTransport.ts`
- `FireOneTransport` ganha `send(frame, opts?: { broadcast?: boolean })` opcional já no shape atual; adicionar método novo no manager **sem mexer no send legado**:
  - `FireOneTransportManager.sendVia(transportId, frame)` — envia via transporte específico (usado pelo discover per-controller).
  - `getConnectedTransports(): FireOneTransport[]` — lista filtrada para iterar no scan.

### 2. `src/lib/fireoneProtocol.ts`
- **Capturar origem do frame**: o handler `transportManager.on('data')` já recebe `transportId`. Encaminhar para `processIncoming(chunk, transportId)` → `handleFrame(frame, transportId)`. Hoje o `transportId` é descartado.
- Estender `FireOneEvent` com `transportId?: string` (back-compat opcional).
- Em `handleFrame`, no caso `IDENTIFY` / `STATUS`: gravar `status.transport = mapTransportType(t.type)` e `status.controllerId = transportId`, `status.controllerLabel = t.label` (ex: "XL4 Gateway", "RS-485 Cable"). Para WiFiDirect, usar `connectedDevice.label`/`deviceType` quando disponível.
- Novo `discoverModules(maxAddr, opts?: { transportId?: string })`:
  - Sem `opts.transportId`: itera todos `transports.connected` e dispara IDENTIFY 1..maxAddr **em cada um** com gap 50ms, marcando o destino via `sendVia`.
  - Com `transportId`: escopo a um controlador (usado pela UI quando o usuário clica "rescan XL4").
- `FireOneModuleStatus`: adicionar campos opcionais `controllerId?: string`, `controllerLabel?: string` (já tem `transport?`).

### 3. `src/lib/moduleAggregator.ts`
- `AggregatedModule` ganha `controllerId?: string` e `controllerLabel?: string`.
- `keyFor(model, address, controllerId?)` passa a usar `controllerId` quando presente → mesmo endereço atrás de XL4 e XL2 vira **duas linhas distintas** (que é o comportamento real).
- `aggregatedToFireOneStatus` propaga os novos campos.

### 4. `src/hooks/useFireOneHardware.ts`
- No subscribe do controller: ler `event.transportId` e gravar em `status.controllerId` / `controllerLabel`; chamar `moduleAggregator.upsert({ controllerId, controllerLabel, transport: <real>, ... })` em vez do `transport: 'serial'` hardcoded.
- `discoverModules(maxAddr, opts?)` repassa `opts.transportId` ao controller.

### 5. `src/components/editor/FireOneModulesInline.tsx`
- Agrupar `rows` por `controllerLabel ?? transportLabel(m)`.
- Header de cada grupo: ícone do transporte + label + contagem `(n)` + botão `rescan` específico daquele controlador (se `onRescan(controllerId)` for passado pelo pai).
- Mantém comportamento read-only e o `maxRows` global (corte aplicado após o sort por grupo).

### 6. Testes (Vitest)
- `discoverModulesPerController.spec.ts`: stub do `TransportManager` com dois transports fake (id `xl4`, id `xl2`), `discoverModules()` deve chamar `sendVia('xl4', ...)` e `sendVia('xl2', ...)`, e os módulos respondidos por cada um devem aparecer com `controllerId` correto.
- `moduleAggregator.controllerScope.spec.ts`: dois upserts com mesmo `model+address` mas `controllerId` diferente geram duas entries.
- `fireOneModulesInline.grouping.spec.tsx`: dois mocks (controllerLabel "XL4 Gateway" addr 3 e "XL2 Gateway" addr 3) renderizam dois grupos com headers próprios.

---

## Fora de escopo
- Nada de mexer em `pyroTransportPolicy`, `uiCommandGateway`, SafetyStateMachine, ARM/FIRE/E-STOP.
- Sem alterar protocolo de wire (mesmo IDENTIFY, mesmo frame format).
- Sem mover Wi-Fi Direct para fora do TransportManager.

---

## Diagrama do fluxo novo

```text
UI rescan ──► useFireOneHardware.discoverModules(opts?)
                       │
                       ▼
       FireOneController.discoverModules
                       │
              ┌────────┴────────┐
              ▼                 ▼
        sendVia(xl4)        sendVia(xl2)    ... (per connected transport)
              │                 │
              ▼                 ▼
        TransportMgr 'data' { data, transportId }
              │
              ▼
       handleFrame(frame, transportId)
              │
              ▼
   status { controllerId, controllerLabel, transport }
              │
   ┌──────────┴──────────┐
   ▼                     ▼
controller.modules   moduleAggregator.upsert
              │
              ▼
   FireOneModulesInline → grouped roster
```

---

## Arquivos tocados
- `src/lib/fireoneTransport.ts` (+ `sendVia`, `getConnectedTransports`)
- `src/lib/fireoneProtocol.ts` (discover per-controller, propaga transportId)
- `src/lib/moduleAggregator.ts` (controllerId no key + fields)
- `src/hooks/useFireOneHardware.ts` (propaga transportId)
- `src/components/editor/FireOneModulesInline.tsx` (agrupa por controlador)
- 3 specs novos
