## Spec real (extraída de `Timecode.exe` V1.5 — ICET / RJ Equipamentos)

Reverse-engineering do binário revelou o formato e o handshake oficiais:

**Script CSV (importável pelo Timecode):**
- Colunas: `timecode, modulo, canal, abertura`
- Ordenação canônica: `timecode ASC, modulo ASC, canal ASC`
- `timecode` — SMPTE `HH:MM:SS:FF` (30 fps non-drop: HH 0–23, MM 0–59, SS 0–59, FF 0–29)
- `modulo` — inteiro 1–99
- `canal` — inteiro 1–32 **ou** `C` / `F` / `S` (canais especiais: Comum / Flama / Stop)
- `abertura` — inteiro em ms, **múltiplo de 100**, dentro do range min/max do equipamento
- Limite: **9999 disparos** por script
- Título do show: ≤ 20 caracteres ASCII

**Bridge USB serial (envio direto):**
- O Timecode detecta o equipamento via Win32_PnPEntity filtrando por VID/PID:
  - `VID_1A86 PID_7523` (CH340)
  - `VID_0403 PID_6001` (FTDI FT232)
  - `VID_067B PID_2303` (Prolific PL2303)
- Sequência: abre porta → handshake de versão → envia título → envia cues → aguarda ACK → "Exportação concluída"
- Erros tratados pelo firmware: versão incompatível, timeout de resposta, falha na abertura da porta

Assunção (a confirmar no campo): baud 115200 8N1 (default do ICET ESP32; o app expõe `set_serialESP` mas não fixa baud nos strings). Plano deixa configurável.

## O que vai ser feito

```text
src/lib/
  rjIcetScript.ts             [novo] builder + validator do CSV ICET spec-exato
  rjIcetSerialBridge.ts       [novo] Web Serial, filtro VID/PID, handshake, stream cues
  __tests__/rjIcetScript.spec.ts  [novo] specs determinísticas

src/lib/firingSystemExports.ts
  - exportRJEquipamentos: reescrito para delegar a buildIcetScript()
    (header/colunas corretos, SMPTE, abertura múltiplo de 100)
  - FIRING_SYSTEMS entry ganha flag `directSend: true`

src/components/editor/firing/
  ICETDirectSendPanel.tsx     [novo] pareamento + validação + barra de progresso
                               + log honesto de erros do equipamento

src/lib/__tests__/
  rjIcetSerialBridge.spec.ts  [novo] fake port (loopback) + ACK timeout
```

## Detalhes técnicos

### 1. `rjIcetScript.ts` (puro, data-in/data-out)
- `buildIcetScript(items, positions, opts)` → `{ csv: string, cues: IcetCue[], warnings: string[] }`
- Validações idênticas ao Timecode:
  - throw/warn se modulo ∉ [1,99], canal ∉ [1,32]∪{C,F,S}
  - throw/warn se abertura não múltiplo de 100 (auto-quantiza com warning)
  - cap em 9999 cues (resto vai pra `warnings`)
  - título sanitizado pra ≤ 20 chars ASCII
- Ordenação obrigatória `timecode ASC, modulo ASC, canal ASC`
- SMPTE 30fps non-drop (já existe `timeToSMPTE` no projeto)

### 2. `rjIcetSerialBridge.ts` (Web Serial honest-hardware)
- `requestIcetPort()` — `navigator.serial.requestPort({ filters: [...3 VID/PIDs] })`
- `IcetSerialLink` classe: open(baud) → `probeVersion()` → `sendTitle()` → `sendCues(onProgress)` → `close()`
- Frame: comandos em ASCII linha-terminada (placeholder até diff binário do firmware — handshake real precisa de um teste de campo; deixo TODO marcado e bridge abstrata pra encaixar protocolo binário quando confirmado).
- Errors mapeados 1:1 com os do Timecode: `version-incompatible`, `response-timeout`, `port-open-failed`.
- Honest hardware: zero simulação fake, falhas viram resultado `{ ok: false, code, message }`.

### 3. Wiring no `firingSystemExports.ts`
- `exportRJEquipamentos` passa a chamar `buildIcetScript()` (1 linha) — backward-compat: continua retornando string CSV.
- Entry ICET ganha `directSend: true` e `directSender: 'icet'` no registry (campo opcional novo).

### 4. UI `ICETDirectSendPanel.tsx`
- Botão "Parear equipamento ICET" → `requestIcetPort()`
- Pré-validação roda local; mostra os warnings antes do envio.
- "Enviar para equipamento" desabilitado se Web Serial indisponível (toast com motivo: HTTPS + Chrome/Edge desktop).
- Progress 0–100% por cue enviado; cancelável; resultado final ("Exportação concluída" ou erro do equipamento).
- Painel embedável no ExportCenter existente (não cria rota nova).

### 5. Safety
- Não toca `CommandBus`, `FieldBus`, `uiCommandGateway`, `SafetyStateMachine`.
- Export é doc-artifact + transferência de script (não dispara). Equipamento decide quando armar — o app só transfere bytes.
- Sem mudança de `workMode`. Disponível em design/simulation/real_operation.

### 6. Tests
- `rjIcetScript.spec.ts`: 8+ tests (SMPTE format, ordenação canônica, abertura múltiplo 100, canais C/F/S, cap 9999, título 20 chars, quantização warning, sort estável).
- `rjIcetSerialBridge.spec.ts`: fake port com loopback validando ACK timeout, version probe, progress callback monotônico.

## Riscos / abertos honestos

- **Baud rate e frame binário do handshake** — strings não revelam. Marcado como TODO no bridge; abstrato o suficiente pra trocar a camada `frame()` sem mexer na UI/validação. Pode rodar field-test sniffing com `Wireshark USB + cabo Y` pra fechar a spec depois.
- Web Serial não funciona em iOS Safari nem dentro de iframe sem permissions-policy — o painel detecta e instrui.