
# FireOne Wireless — Toggle CABLE/WIRELESS/AUTO + RSSI/Bateria

Adiciona suporte explícito a módulos FireOne via rádio (TNC USB-RF dock) ao lado do cabo XLII+ existente, expondo no painel a alternância entre os modos e os indicadores ao vivo de sinal e bateria por slat — sem inventar dados.

## Escopo (cirúrgico)

### 1. `src/features/fieldbus/useFireOneFleet.ts` — refactor
Hoje o hook abre um único `SerialTransport` 9600 (cabo). Vai virar fleet de **dois** transports independentes:

- `cable` — `SerialTransport` 9600 8N1 (XLII+/XL4-3 direto via FTDI).
- `radio` — `SerialTransport` **38400 8N1** (dock USB-RF do TNC FireOne).

Estado novo:
```ts
mode: 'cable' | 'wireless' | 'auto'  // persistido em fxk.fireone.linkMode.v1
cable: { state, error, txBytes, rxBytes, lastReplyAt }
radio: { state, error, txBytes, rxBytes, lastReplyAt }
link:  // agregado: 'connected' se qualquer link up
```

Comportamento por modo:
- **cable**: abre só o transport 9600 → registra `cableLink` no `realTransports` (rs485).
- **wireless**: abre só o transport 38400 → registra `radioLink` no `realTransports` (relay).
- **auto**: abre cabo primeiro; se em 3s nenhum slat respondeu, abre radio em paralelo. Ambos podem coexistir.

Cada slat recebido é taggeado com `connectionMode: 'wired' | 'wireless'` segundo o link de origem da resposta. O polling 2 Hz prioriza o link de origem do slat.

API pública: + `setMode(mode)`. Mantém `connect/disconnect/arm/disarm/eStop/fire/continuityCheck/queryWireless` (assinaturas inalteradas).

### 2. `src/features/fieldbus/FireOnePanel.tsx` — UI
- **Header**: troca o badge único por **três badges** independentes (CABLE / RADIO / agregado), cada um com cor por estado.
- **Toggle CABLE / WIRELESS / AUTO** (segmented control de 3 botões) na barra de conexão. Persiste e dispara reconnect.
- **Identifiers visuais**: lucide `Cable` para cabo, `RadioTower` para rádio, `Wifi` para AUTO.
- **Strip global** mostrando contagem de slats por modo (`5 wired · 3 wireless`) + RSSI médio dos wireless + bateria mínima da fleet (alerta se < 11.0 V).
- **Card por slat** já tem `Bat`, RSSI e ícone Wifi/WifiOff — reorganizado para destacar `connectionMode` (chip "WIRED"/"WIRELESS"/"FALLBACK") e usa cor amber se RSSI < −85 dBm ou bateria < 11.0 V.
- **Botão RADIO** existente em cada slat continua chamando `queryWireless()` (já implementado no protocolo via `buildWirelessStatusQuery`).

### 3. `src/core/network/realTransports.ts` — sem mudança lógica
Já tem `registerCableLink` + `registerRadioLink` separados. O hook só passa a chamá-los segundo o transport ativo.

### 4. Testes
- `useFireOneFleet.modeToggle.spec.ts` (vitest):
  - `setMode('wireless')` persiste em localStorage e abre transport 38400.
  - `setMode('auto')` programa fallback de 3s para abrir radio se cabo silenciar.
  - Disconnect revoga `cableLink` e `radioLink` no `realTransports`.
- `FireOnePanel.modeToggle.spec.tsx` (RTL):
  - Click em "WIRELESS" chama `setMode('wireless')` e mostra badge de rádio ativo.
  - Slat com `connectionMode='wireless'` renderiza chip WIRELESS + RSSI.

## Fora de escopo
- `FireOneRadioDiscoverer` standalone (auto-detectar dock TNC entre as portas serial sem operador clicar Connect) — fica para a próxima.
- Página `/dev/hardware-integration` (matriz JOI) — fica para a próxima.

## Arquivos
```text
EDIT  src/features/fieldbus/useFireOneFleet.ts        (~200 linhas, refactor)
EDIT  src/features/fieldbus/FireOnePanel.tsx          (~70 linhas: header, toggle, badges, strip)
NEW   src/features/fieldbus/__tests__/useFireOneFleet.modeToggle.spec.ts
NEW   src/features/fieldbus/__tests__/FireOnePanel.modeToggle.spec.tsx
ZERO  uiCommandGateway, commandBus, SafetyStateMachine, fieldBus, pyroExecutor,
      pyroTransportPolicy, _quarantine, fireoneProtocol, realTransports
```

## Resultado
Operador no painel FireOne escolhe **CABLE** (XLII+ via FTDI), **WIRELESS** (TNC USB-RF) ou **AUTO** (cabo prioritário, rádio como fallback automático). Cada slat exibe RSSI e tensão de bateria reais (ou nada — sem fake), com chip indicando por qual link respondeu. O caminho de FIRE permanece exatamente o mesmo: `uiCommandGateway → commandBus → commandFireRouter → pyroExecutor → fieldBus → realTransports.{rs485|relay}` — a única diferença é qual link estará vivo.
