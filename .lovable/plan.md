

# Ciclo de Engenharia #23 — Hardware Calibration + PBUS Bug Fix + cFlamer mVolcano Integration

## Problemas e Melhorias Identificados

| # | Tipo | Problema | Fonte |
|---|------|----------|-------|
| 1 | **BUG** | `buildPBusFrame` aloca frame com tamanho errado e faz double-copy (cria array de `inner.length + 3`, depois cria `full` com `frame.length + 1`). Desperdiça memória e um slot do frame original fica com zero (byte fantasma antes do TERMINATOR) | `pbusProtocol.ts` L101-114 |
| 2 | **BUG** | `parsePBusResponse` verifica `data.length < 6` mas o frame mínimo real é 7 bytes (preamble+addr+cmd+len+crc_hi+crc_lo+term). Frames de 6 bytes passam a validação e produzem leitura fora de limites | `pbusProtocol.ts` L178 |
| 3 | **MISSING** | **cFlamer mVolcano** — novo equipamento Showven com 5 nozzles, 3 modos DMX (6CH-N, 6CH-M, 6CH-P), 88 preset sequences e E-Stop chain. Não existe no sistema | Manual `53cd42-2.pdf` |
| 4 | **WRONG** | `cflamer_volcano` em `showvenPresets.ts` tem `dmxChannels: 12` mas o manual real diz **6 canais** (3 modos: 6CH-N, 6CH-M, 6CH-P). `fuelCapacityL: 5.3` mas manual diz **7.5L**. `weightKg: 22` mas manual diz **26kg** | Manual vs L114-117 |
| 5 | **WRONG** | `cFlamer` preset tem `dmxChannels: 8` mas o modelo original cFlamer usa 2CH-P/2CH-N. O mVolcano é que usa 6CH. Confusão entre modelos | `showvenPresets.ts` L104 |
| 6 | **MISSING** | **PyroAdaptor** — controller para carga de 25x PyroSlave C16 via PBUS. Não existe nos presets de controllers | Manual C16 p.5 |
| 7 | **MISSING** | Perfil DMX completo do Maiman com **16 canais FB3** + **39 canais FB4**: Page/Cue/Speed/Dimmer/Zoom/SizeXY/AngleZ/PosXY/ScanRate. Atual tem apenas `dmxChannels: 12` genérico | Manual Maiman p.16 |
| 8 | **MISSING** | FXbutton DMX presets por device type: Sparkular (Height+Duration), cFlamer (Timer), CO2 Jet, Confetti — cada um com channel layout específico. Atual tem apenas effects genéricos | Manual FXbutton p.5 |
| 9 | **BUG** | `processIncoming` em PBusController cria novo `Uint8Array` em cada chunk recebido (GC pressure). Para sistema de campo 60Hz polling de 64 devices, isso gera ~128 alocações/segundo | `pbusProtocol.ts` L322-326 |
| 10 | **MISSING** | DMX Splitter 8 com indicadores E-STOP e feedback bidirecional com dispositivos Showven. Preset atual não reflete o status de E-STOP chain com indicadores de LED | Manual DMX Splitter |

## Plano de Implementação

### Arquivo 1: `src/lib/pbusProtocol.ts` — 3 fixes

**Fix 1: `buildPBusFrame` double allocation**
- Calcular tamanho correto: `1 (preamble) + inner.length + 2 (crc) + 1 (term) = inner.length + 4`
- Alocar single `Uint8Array` com tamanho exato, eliminar double-copy

**Fix 2: `parsePBusResponse` min frame size**
- Mudar `data.length < 6` para `data.length < 7` (frame mínimo real com payload 0)

**Fix 3: `processIncoming` ring buffer**
- Pré-alocar buffer de 1024 bytes com writeOffset
- Evitar `new Uint8Array` e `.slice` em cada chunk recebido

### Arquivo 2: `src/lib/showvenPresets.ts` — Calibração de specs

**Fix 4: Corrigir cFlamer Volcano specs**
- `dmxChannels: 6` (era 12), `fuelCapacityL: 7.5` (era 5.3), `weightKg: 26` (era 22)
- Adicionar `nozzleAngles: [1,2,3,4,5]` e description com modos DMX

**Fix 5: Corrigir cFlamer base specs**
- `dmxChannels: 2` (era 8) — modelo base usa 2CH-P/2CH-N

**Fix 6: Adicionar PyroAdaptor ao SHOWVEN_CONTROLLERS**
- Capacidade: 25 C16 units, PBUS charging, dual-band RF

**Fix 7: Atualizar Maiman DMX channels**
- `dmxChannels: 16` (FB3 mode) com nota sobre modo FB4 39CH
- Adicionar `defaultSampleRate` per model: 30K/25K/20K

### Arquivo 3: `src/components/editor/live-firing/constants.ts` — DMX profiles

**Fix 8: cFlamer mVolcano DMX profile completo**
- Adicionar entry `lib-cflamer-mvolcano` com 3 modos DMX (6CH-N, 6CH-M, 6CH-P)
- 88 preset sequences mapeados (CH5 DMX values)
- Safety channel com threshold 50-200

**Fix 9: FXbutton device-specific presets**
- Sparkular: Height(CH1) + Duration(CH2)
- cFlamer: Timer + firing modes
- CO2 Jet, Confetti: channel-specific effects

**Fix 10: Maiman DMX fixture profile 16CH**
- Channels: Mode(1), Page(2), Cue(3), Speed(4), Dimmer(5), Zoom(6), SizeX(7), SizeY(8), AngleZ(9), PosX(10), PosY(11), VisiblePts(12), ScanRate(13), CueRelease(14), Reserved(15-16)

### Arquivo 4: `src/components/editor/VirtualControllerHub.tsx`

**Fix 11: Adicionar cFlamer mVolcano e PyroAdaptor ao hub**

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Fix PBUS frame builder + parser (bugs críticos de protocolo) |
| 2 | Fix processIncoming ring buffer |
| 3 | Calibrar showvenPresets com specs reais dos manuais |
| 4 | Atualizar DMX profiles em constants.ts |
| 5 | Adicionar novos devices ao VirtualControllerHub |
| 6 | Build verification |

