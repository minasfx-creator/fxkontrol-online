## Adapter FireOne XL4+ — promoção a hardware de 1ª classe

Hoje o `useFireOneFleet` (XLII+/XL4-3) já fala o protocolo serial real (RS-485 9600 8N1 + TNC 38400) com `IDENTIFY`, `STATUS`, `CONTINUITY`, `EMERGENCY_STOP` etc. e o `FireOneProfileAdapter` só cobre o lado de **export profile** (logical, sem hardware). O que falta é tratar o XL4+ como o FXK16/FXK32Q: adapter físico no `UnifiedHardwareRegistry` + promoção via `discoveryRegistryBridge` + presence hook honesto + adoção pelo `AutoControllerLauncher` com gates pyro de safety.

### Objetivo

Sair do "console funciona, mas a frota XL4+ vive fora do registry" para "qualquer XL4+/XLII+ ligado é um `PhysicalDevice` reconhecido, com provenance LIVE READ-ONLY após handshake, presence hook real, e disponível no AutoControllerLauncher com Hold-800ms e respeitando `pyroTransportPolicy` (BLE banido em `real_operation`)."

### Arquivos novos

```
src/core/hardware/adapters/FireOneXL4Adapter.ts
src/hooks/useFireOneXL4Bridge.ts          (subscribe não-React do useFireOneFleet)
src/hooks/useFireOneXL4Presence.ts
src/__tests__/fireOneXL4Adapter.spec.ts
src/__tests__/useFireOneXL4Presence.spec.ts
src/__tests__/fireOneXL4DiscoveryBridge.integration.test.ts
```

### Arquivos editados

```
src/core/hardware/discoveryRegistryBridge.ts   (+ subscribeFireOneXL4Bridge wiring)
src/core/discovery/controllerRegistry.ts        (refinar consoleRoute do kind 'fireone')
src/__tests__/mocksErradicated.guard.spec.ts    (incluir os novos arquivos no allowlist honest-hw)
src/features/fieldbus/useFireOneFleet.ts        (expor snapshot p/ subscribe externo)
```

### O que cada parte faz

**1. `FireOneXL4Adapter`** — espelha `FXK16ModuleAdapter`:

- `deviceType: 'pyro-master'`, `firmwareModel: 'FireOne-XL4'`, `protocolFamily: 'fireone-xlii-plus'`
- `getCapabilities`: `canRead/canDiagnose/supportsTelemetry/supportsContinuity = true`, `canWrite = false` (escrita só via `uiCommandGateway`), `maxChannels = 40 × 32 = 1280`, protocolos `['serial-9600', 'serial-38400-tnc']`
- Estado: `Map<moduleAddr, FireOneModuleStatus>` + agregados (`armed_modules`, `total_modules`, `wireless_modules`, `fault_modules`)
- `markHandshakeOk(transport)` / `markHandshakeLost()` ⇒ atualiza `_provenance` via `markHandshakeOk`/`markHandshakeLost` do `provenance.ts`
- `pollTelemetry()` no-op (dados chegam pelo `useFireOneFleet`); `runDiagnostics()` reporta `wireless_fallback`, `low_battery <11.5V`, `temp >55°C`

**2. `useFireOneXL4Bridge`** — singleton subscribable não-React:

- Padrão idêntico a `subscribeFXK32QBridge` (Set de listeners + getter da última snapshot)
- `useFireOneFleet` publica via `_publishFleetSnapshot()` (export pequeno) sempre que `state.modules`, `cable.state` ou `radio.state` mudam
- Snapshot exposto: `{ connected, transport: 'cable'|'radio'|null, moduleCount, identifyCount, lastReplyAt, latencyMs, modules }`

**3. `discoveryRegistryBridge`** — adicionar bloco análogo ao FXK32Q:

```text
_unsubFireOneXL4 = subscribeFireOneXL4Bridge((snap) => {
  const verified = snap.connected && snap.identifyCount > 0 && snap.moduleCount > 0;
  if (verified === _lastFireOneXL4Verified) return;
  _lastFireOneXL4Verified = verified;
  if (verified) {
    fireOneXL4Adapter.markHandshakeOk(snap.transport === 'radio' ? 'rf_lora' : 'serial_usb');
    unifiedHardwareRegistry.startPolling(1000);
  } else {
    fireOneXL4Adapter.markHandshakeLost();
  }
});
```

`stopDiscoveryRegistryBridge` desfaz tudo; `_lastFireOneXL4Verified` reseta.

**4. `useFireOneXL4Presence`** — espelha `useFXK32QPresence`:

- Combina 3 sinais: `useActiveControllers().controllers.find(kind==='fireone')` + `fireOneXL4Adapter.getConnectionState()` + `isProvenanceVerified(fireOneXL4Adapter.getProvenance())`
- `reason`: `'no-device' | 'device-only' | 'connected-unverified' | 'present'`
- Polling 1s no adapter; aggregator é reativo

**5. `controllerRegistry`** — manter `kind: 'fireone'`, atualizar `consoleRoute` para `/studio?panel=pyro-fireone` (já está OK), garantir que regras de `FAMILY_RULES` cobrem `fireone-xl4-3` (regex já cobre).

**6. AutoControllerLauncher** — não precisa de mudança: já lê `controllerProfile.capabilities.safetyCritical: true` e força Hold-800ms para `kind: 'fireone'`. Validar via teste integração.

### Garantias preservadas (não mexer)

- ✅ Comando físico continua **exclusivo** via `uiCommandGateway → CommandBus → SafetyStateMachine → FieldBus`. O adapter é READ-ONLY no registry; `canWrite: false`.
- ✅ `pyroTransportPolicy` já tem `[serial, usb, artnet]` e bane BLE em `real_operation` — XL4+ via `cable` (serial 9600) está em `serial`, via `radio` (TNC 38400) está em `serial` também (não-BLE).
- ✅ `realOnlyGate` rejeita telemetria sem handshake verificado; o snapshot do XL4+ só é aceito após `markHandshakeOk`.
- ✅ `safetyBlackBox` já registra `fireone-cable-connect` / `fireone-radio-connect` via `recordSafetyNote` no `useFireOneFleet`.
- ✅ Zero `Math.random`, zero mock — guard `mocksErradicated.guard.spec.ts` cobre os novos arquivos.

### Testes (vitest)

- `fireOneXL4Adapter.spec.ts` — handshake ok/lost atualiza `connected/disconnected` e `provenance.integration_mode`; snapshot reporta `online`, `metrics.modules`, `metrics.faults`; `runDiagnostics` flagga low-battery e wireless-fallback
- `useFireOneXL4Presence.spec.ts` — 5 cenários idênticos ao FXK32Q (no-device/device-only/connected-unverified/present/cleanup-no-leak)
- `fireOneXL4DiscoveryBridge.integration.test.ts` — publica snapshot mockado e verifica que o adapter sai de `not_integrated` → `live_read_only` (e volta)

### Não-objetivos desta rodada

- Não tocar no `FireOneProfileAdapter` (export profile permanece como está).
- Não escrever no FXK-PYRO 2.0 array por aqui — escrita continua via panel `/studio?panel=pyro-fireone`.
- Não adicionar UI nova de status — o XL4+ já aparece no `FieldDiagnosticsDock` automaticamente assim que o adapter está no `unifiedHardwareRegistry`.
- Não promover M1 / FX Commander Pro / Maiman — esses são as próximas rodadas.

### Critério de pronto

```text
1. Registry tem entrada 'fireone-xl4' com provenance live_read_only após handshake real
2. /dev/real-discovery mostra o XL4+ como PhysicalDevice kind='fireone'
3. AutoControllerLauncher exibe card "FireOne FXK-PYRO 2.0" com Hold-800ms
4. FieldDiagnosticsDock lista o XL4+ com transport e idade
5. useFireOneXL4Presence retorna present=true ⇒ hook pronto para gating em FieldOps
6. Testes 3/3 + integration 1/1 verde, suite total mantém 1263+
```
