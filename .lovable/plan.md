
# Desligar todos os hardwares simulados — Detecção real apenas

## Estado atual (já honesto na maior parte)

A "Honest Hardware Layer" anterior já garante que:
- `createSimulatedProvenance()` retorna `integration_mode: 'not_integrated'` por padrão
- `UnifiedHardwareRegistry` exibe banner: *"No synthetic data is being generated"*
- Não há fixtures em `src/dev/` (pasta vazia), nem fleet de UAVs simulados auto-spawnado

**Porém**, ainda existem 4 vazamentos de dados sintéticos quando um adapter aparece como `connected`:
- Adapters `pollTelemetry()` em `ArduinoNanoAdapter`, `ArtNetNodeAdapter`, `BatteryMonitorAdapter`, `DMXUniverseAdapter`, `MuxReaderAdapterCD4051`, `RelayBankAdapter32` injetam valores via `Math.random()`
- `ContinuityCheckService._simulateRead()` é chamado quando nenhum reader real é passado
- `fireoneModuleEmulator` tem `simulateHardware: true` por padrão (continuidade aleatória)
- `grandMA3Node.simulateInput()` injeta universos DMX falsos
- Flag `dev_hardware_simulator` mencionada no memory **não existe** em `featureFlags.ts` — precisa ser adicionada como gate central

## Mudanças propostas

### 1. Adicionar flag central `dev_hardware_simulator` (default `false`)
**Arquivo:** `src/lib/featureFlags.ts`
- Nova flag `dev_hardware_simulator: false`
- Helper `isHardwareSimulatorEnabled()` para uso direto

### 2. Gatear toda geração sintética nos adapters
**Arquivos:** todos em `src/core/hardware/adapters/*.ts` que usam `Math.random()`
- ArduinoNanoAdapter, ArtNetNodeAdapter, BatteryMonitorAdapter, DMXUniverseAdapter, MuxReaderAdapterCD4051, RelayBankAdapter32
- Pattern: envolver bloco de geração sintética com `if (isHardwareSimulatorEnabled() && this._connected === 'connected') { ... }` 
- Quando flag OFF: `pollTelemetry()` mantém valores zerados/iniciais. UI mostra valores "frios" (0Hz, 0V, sem leituras) → operador percebe imediatamente que não há hardware real respondendo

### 3. Gatear `ContinuityCheckService._simulateRead()`
**Arquivo:** `src/core/safety/ContinuityCheckService.ts`
- Quando `reader` ausente e flag OFF: marcar pin como `UNKNOWN` com `ohms: Infinity` (sem inventar resistências aleatórias)
- Mensagem de log: `"NO_READER — pin marked UNKNOWN"`

### 4. Gatear `fireoneModuleEmulator`
**Arquivo:** `src/lib/fireoneModuleEmulator.ts`
- Default de `simulateHardware` muda de `true` para `false` quando flag OFF
- Continuidade falsa (`Math.random() > 0.3`) só roda com flag ON

### 5. Gatear `grandMA3Node.simulateInput()`
**Arquivo:** `src/lib/grandMA3Node.ts`
- Método `simulateInput()` vira no-op quando flag OFF (com `console.warn` informativo)

### 6. Atualizar banner do `UnifiedHardwareRegistry`
**Arquivo:** `src/core/hardware/UnifiedHardwareRegistry.ts`
- Banner enfatiza estado: *"Hardware simulator: OFF. Pure real-hardware discovery via Web Serial / WebUSB / WebBLE / Art-Net."*

### 7. Painel Settings → Hardware (informativo)
**Novo:** `src/components/settings/HardwareSimulatorSettings.tsx`
- Banner mostrando estado da flag (OFF — modo testes), lista dos 8 adapters em estado `not_integrated`, instruções de reativação

## Resultado esperado

- ✅ **Zero `Math.random()`** alimentando UI sem hardware real conectado
- ✅ Adapters listados, mas todos visivelmente "frios" (0/0/UNKNOWN) até descoberta real
- ✅ Discovery real (Web Serial/USB/BLE/Art-Net) continua 100% funcional — apenas ele alimenta dados
- ✅ Continuidade pinos = `UNKNOWN` sem reader real (não passa para `OK` falso)
- ✅ FireOne emulator/MA3 não inventam estado
- ✅ Reativação trivial: flip `dev_hardware_simulator: true` em `featureFlags.ts`

## Detalhes técnicos

```text
ANTES:                                  DEPOIS:
adapter.pollTelemetry()                 adapter.pollTelemetry()
 └─ if connected:                        └─ if connected && simulator ON:
     state.x = Math.random() * 4             state.x = Math.random() * 4
                                           else: state.x permanece 0/inicial

ContinuityCheckService                  ContinuityCheckService
 └─ if !reader: simulateRead()           └─ if !reader && simulator OFF:
                                              ohms = Infinity, status = UNKNOWN
                                            else: simulateRead()

fireoneModuleEmulator                   fireoneModuleEmulator
 simulateHardware = true (default)       simulateHardware = simulator flag ON
```

**Memory update:** atualizar `mem://funcionalidades/honest-hardware-layer` para refletir que `dev_hardware_simulator` agora existe como flag real (default OFF) e gateia todos os pontos sintéticos remanescentes.

**Não-mudanças (preservados):**
- `provenance.ts` (já honesto)
- `UnifiedHardwareRegistry.registerAdapter()` (já registra como `not_integrated`)
- Caminho de discovery real (`portRegistry`, `unifiedDiscovery`, `ArtPoll`)
- Componentes de UI que renderizam adapters (já lidam com estado `disconnected`)
