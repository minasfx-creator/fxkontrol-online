

# Ciclo de Engenharia #24 — FXcommander Device Library + FireOne Module Bugs

## Bugs e Melhorias Identificados

| # | Tipo | Problema | Local |
|---|------|----------|-------|
| 1 | **BUG** | `fireGroup` usa `pins.indexOf(pin)` para detectar último pin — retorna primeiro índice de valor duplicado, não o índice atual do loop. Se `pins = [0, 0, 1]`, o stagger delay é aplicado incorretamente | `fireoneModuleEmulator.ts` L321 |
| 2 | **MISSING** | Dispositivos do catálogo FXcommander ausentes na biblioteca: **Sonicboom 11CH**, **Sonicboom Plus 14CH**, **SPARKULAR TRIPLE 6CH**, **SPARKULAR SPIN**, **SPARKULAR FALL**, **uFlamer Volcano 6CH** | `constants.ts` SHOWVEN_LIBRARY |
| 3 | **MISSING** | Presets Sparkular individuais (Jet II 4CH, Cyclone II 6CH) existem em `showvenPresets.ts` mas não têm entries correspondentes na `SHOWVEN_LIBRARY` de `constants.ts` para uso no Super DMX | `constants.ts` |
| 4 | **MISSING** | Campo `group` para Manual Fire cue grouping — manual FXcommander descreve agrupamento de cues adjacentes que disparam juntos. O tipo `CueEntry` não tem campo `group` para vincular cues | `types.ts` |
| 5 | **BUG** | cFlamer 2CH-N safety logic invertida — em modo 2CH-N, CH2 `0-239 = Pressure Relief` (E-Stop) e `240-255 = Compression` (enable). O `safetyValue: 127` está no range de E-Stop para modo N | `constants.ts` L95 |
| 6 | **MISSING** | FXcommander console specs ausentes — dual-core processor, 3×18650 battery, IP ratings, version V1.5 boot — não existe perfil de controlador para o FXcommander | `showvenPresets.ts` CONTROLLERS |

## Plano de Implementação

### Arquivo 1: `src/lib/fireoneModuleEmulator.ts` — 1 fix

**Fix 1: `fireGroup` loop index**
- Trocar `for (const pin of pins)` + `pins.indexOf(pin)` por `for (let i = 0; i < pins.length; i++)` + `i < pins.length - 1`

### Arquivo 2: `src/components/editor/live-firing/constants.ts` — 7 entries

**Fix 2: Adicionar dispositivos faltantes do catálogo FXcommander à SHOWVEN_LIBRARY**
- `lib-sonicboom` — Sonicboom 11CH (based on FXcommander device list)
- `lib-sonicboom-plus` — Sonicboom Plus 14CH
- `lib-sparkular-triple` — SPARKULAR TRIPLE 6CH
- `lib-sparkular-spin` — SPARKULAR SPIN (rotational sparkular)
- `lib-sparkular-fall` — SPARKULAR FALL (waterfall sparkular)
- `lib-sparkular-cyclone` — SPARKULAR CYCLONE 6CH
- `lib-sparkular-jet` — SPARKULAR JET II 4CH

**Fix 3: Corrigir cFlamer safety values por modo DMX**
- 2CH-P: safetyValue no range 50-200 (correto: 127)
- 2CH-N: safetyValue deve ser 240-255 para enable (era 127 — incorreto para modo N)
- Adicionar nota nos comentários sobre diferença por modo

### Arquivo 3: `src/components/editor/live-firing/types.ts` — 1 campo

**Fix 4: Adicionar campo `manualGroup` ao CueEntry**
- `manualGroup?: number` — cues com mesmo groupId adjacente disparam juntos (manual FXcommander p.29)

### Arquivo 4: `src/lib/showvenPresets.ts` — 1 entry

**Fix 5: Adicionar FXcommander ao SHOWVEN_CONTROLLERS**
- FXcommander Pro: 128 cues × 4 scenes, dual-band pyro (433M/868M), 2.4GHz wireless DMX, MIDI/LTC input, battery powered

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Fix fireGroup loop index bug |
| 2 | Adicionar dispositivos FXcommander ao SHOWVEN_LIBRARY |
| 3 | Corrigir cFlamer safety values por modo |
| 4 | Adicionar manualGroup ao CueEntry |
| 5 | Adicionar FXcommander ao controllers |
| 6 | Build verification |

