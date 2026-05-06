
# Module Roster — tela de inventário ao vivo da fleet FireOne

Cria uma tela `/dev/module-roster` que lista cada módulo conhecido e classifica-o em **NOT INTEGRATED / OFFLINE / ONLINE** a partir de telemetria real, com endereço, contagem de cues, COM LED e indicadores RSSI / bateria — sem inventar dados.

## O que vai ser construído

### `src/pages/dev/ModuleRoster.tsx` (novo, ~200 linhas)
Página standalone que monta `useFireOneFleet` e renderiza uma tabela:

| Coluna | Origem | Comportamento |
|---|---|---|
| **COM** | `lastReplyAt` da link que respondeu | LED `CircleDot` esmeralda pulsa quando frame < 800ms; cinza se nunca chegou |
| **ADDR** | `module.moduleAddress` | `01..99` zero-padded |
| **STATE** | derivado | `ONLINE` se telemetria ≤5s · `OFFLINE` se >5s · `NOT INTEGRATED` se nunca respondeu |
| **LINK** | `connectionMode` | chip `WIRED / WIRELESS / FALLBACK` (cor por tipo) |
| **CUES** | `igniters[]` | `cuesOk / cuesConnected` (continuidade OK / conectados) |
| **RSSI** | `rssiDbm` ou `—` | amber se <−85 dBm |
| **BAT** | `batteryVoltage` ou `—` | amber se <11.0 V |
| **FW** | `firmwareVersion` ou `—` | mono |
| **LAST** | `Math.round((now − lastReplyAt)/1000)+'s ago'` | `—` se NOT_INTEGRATED |

**Strip agregada** no topo: `ONLINE: N · OFFLINE: M · NOT INTEGRATED: K · Link: <state> · Mode: <mode>`.

**Linhas placeholder NOT INTEGRATED**: para qualquer endereço entre 1 e o maior endereço já visto que nunca respondeu, gera linha cinza com cues `—` (transparência operacional — sem inventar slot ativo).

**Tick interno** de 500 ms (`setInterval` em `useEffect` com cleanup) só para reavaliar OFFLINE/COM-pulse a partir dos timestamps. Zero polling adicional ao bus — apenas leitura do estado já mantido pelo hook.

### Rota em `src/App.tsx`
```ts
const ModuleRoster = lazy(lazyRetry(() => import("./pages/dev/ModuleRoster")));
// ...
<Route path="/dev/module-roster" element={<ModuleRoster />} />
```
Inserida ao lado de `/dev/readiness-audit`.

## Honesty contract
- Sem `connectionMode` ⇒ chip mostra `—`, não inventa "WIRED".
- Sem `lastReplyAt` ⇒ COM LED apaga, LAST = `—`, STATE = `NOT INTEGRATED`.
- `rssiDbm`/`batteryVoltage` ausentes ⇒ célula `—`, nunca zero falso.

## Fora de escopo
- Edição de roster / pairing — esta tela é read-only.
- Persistência do roster esperado — usa só o que o bus realmente acknowledgou.
- Integração com FXK16 / Arduino Nano — fica para próxima (esta tela é FireOne-only).

## Arquivos
```text
NEW   src/pages/dev/ModuleRoster.tsx   (~200 linhas)
EDIT  src/App.tsx                      (+2 linhas: lazy import + Route)
ZERO  uiCommandGateway, commandBus, fieldBus, useFireOneFleet (apenas consumido)
```

## Resultado
Operador acessa `/dev/module-roster` e vê, em tempo real, exatamente quais módulos a frota reconheceu, quais sumiram (OFFLINE) e quais estão no plano mas nunca falaram (NOT INTEGRATED) — com COM LED pulsando a cada frame de telemetria, contagem de cues funcionais por slat, e indicadores honestos de sinal e bateria.
