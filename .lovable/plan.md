

# Ciclo de Calibracao #10 — Conformidade 100% com Manuais (Bíblia Pirotécnica)

## Auditoria: O Que Já Está Implementado vs O Que Falta

### Implementado (OK)
- `FLICKER_BY_COMPOUND`: 15 compounds (strontium, barium, copper, sodium, titanium, magnesium, charcoal, iron, flash, aluminum, phenolic, magnalium, zinc, antimony, sulfur)
- `strobeFlicker()`: modelo oscilatório smolder/burn
- `thermalColorRamp()`: path especial para flash (`isFlash`)
- `COMBUSTION_HEAT_KCAL`: 9 metais com calor de combustão
- `getCombustionHdrBoost()`: normalização por metal
- `particleChemistry.ts`: 14+ compounds com dados completos (ignição, densidade, ponto de fusão)
- NEB/T M-251 tabela regulatória
- Perfil PIROEX/Skyking com dados FFIC

### Problemas Críticos — Funções Existem Mas NUNCA São Chamadas

| # | Gap | Evidência | Fonte |
|---|-----|-----------|-------|
| 1 | **`strobeFlicker()` nunca chamado** — existe em pyroNoise.ts mas nenhum renderer a utiliza. Dragon eggs/strobe stars ficam sem efeito ON/OFF real | Busca em src/components: 0 chamadas | Chemistry of Pyrotechnics p.3: "oscillatory burning effect" |
| 2 | **`getCombustionHdrBoost()` nunca chamado** — tabela de calor existe mas brilho de alumínio/magnésio/ferro é IDÊNTICO no render | Busca em src/components: 0 chamadas | Flash Powder p.16: "6000 kcal" Mg, "7400 kcal" Al |
| 3 | **`thermalColorRamp(isFlash=true)` nunca chamado** — nenhum caller passa `isFlash=true`. Flash powder renderiza como estrela normal | Busca: 6 arquivos usam thermalColorRamp, nenhum com isFlash | Flash Powder p.6: "burns in thousandths of a second" |
| 4 | **Calcium sem flicker entry** — particleChemistry tem calcium mas FLICKER_BY_COMPOUND não | Chemistry p.12: "rojo claro por compuestos de calcio" |
| 5 | **Black powder sem flicker entry** — compound existe mas sem parâmetros de flicker | Chemistry p.1: "75% KNO3, 10% S, 15% C" |
| 6 | **Lead/Bismuth (dragon eggs) sem compound** — manuals descrevem oscilação violenta com magnalium + PbO/Bi2O3 | Chemistry p.4: "oscillatory burning more vigorous than strobe" |
| 7 | **Chlorine donor model ausente** — copper blue REQUER PVC/Parlon para CuCl2. Sem chlorine donor → cor deveria ser verde, não azul | Chemistry p.4: "CuO + Cl → CuCl2 blue emission" |
| 8 | **Fórmulas flash reais não calibradas** — 15+ fórmulas específicas no Flash Powder book (Standard Salute, Clark, Chinese, Military M-80) com características distintas de velocidade/intensidade | Flash Powder pp.21-28 |

## Soluções — 5 Tarefas

### Tarefa 1: Integrar `strobeFlicker` + `getCombustionHdrBoost` no FireworkRenderer
**Arquivo**: `FireworkRenderer.tsx`

No bloco de flicker (linhas ~395-413):
- Quando `compound` contém "magnalium" e pattern suporta strobe → usar `strobeFlicker()` em vez de `temporalFlicker()`
- Aplicar `getCombustionHdrBoost(compound)` como multiplicador do HDR scale (linha ~391)
- Importar `strobeFlicker`, `getCombustionHdrBoost` de pyroNoise

### Tarefa 2: Integrar `isFlash=true` nos callers de `thermalColorRamp`
**Arquivos**: MineEffect, CometEffect, RomanCandleEffect, WaterfallEffect, FanEffect

- Detectar quando compound é "flash" ou "aluminum" + pattern é salute
- Passar `isFlash=true` ao `thermalColorRamp`
- Flash powder em mines: muzzle flash deve usar path especial (80% white-hot)

### Tarefa 3: Adicionar compounds faltantes ao FLICKER_BY_COMPOUND
**Arquivo**: `pyroNoise.ts`

Novos entries baseados nos manuais:
- **calcium**: base 0.55, amplitude 0.38, popStrength 0.40 (rojo claro, irregular como strontium)
- **black_powder**: base 0.60, amplitude 0.35, popStrength 0.30 (KNO3+C+S, moderate)
- **lead**: base 0.35, amplitude 0.55, popStrength 0.65 (dragon eggs, violent oscillation)
- **bismuth**: base 0.38, amplitude 0.52, popStrength 0.60 (dragon eggs substitute)
- **potassium_perchlorate**: base 0.50, amplitude 0.42, popStrength 0.50 (strong oxidizer)

### Tarefa 4: Dragon Eggs burst pattern
**Arquivo**: `burstSimulation.ts`

Adicionar `'dragon_egg'` ao BurstPattern:
- starCount: 40, velocity: 15, spread: 0.6, tailFactor: 0.3, gravityMult: 1.8, symmetry: 0
- No renderer, dragon_egg stars usam `strobeFlicker()` com smolder=0.2s, burn=0.08s (mais rápido que strobe normal — "more vigorous than strobe" per Chemistry book)

### Tarefa 5: Flash formula variations na particleChemistry
**Arquivo**: `particleChemistry.ts`

Adicionar variações reais do Flash Powder book:
- **flash_standard**: KClO4 66% + Al 34% (Standard Salute) — baseline
- **flash_clark**: KClO4 7 + Al flake 5 — "very good high velocity mix"
- **flash_chinese**: KClO4 3 + Al 4 + S 3 — "very hot mix"
- **flash_military_m80**: KClO4 + Mg + Al flake — "slow burning, hard to ignite"

Cada variação com `burnRate` diferente modelando velocidade real.

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `src/components/editor/skycanvas/FireworkRenderer.tsx` | Integrar strobeFlicker, getCombustionHdrBoost |
| `src/components/editor/effects/MineEffect.tsx` | thermalColorRamp com isFlash |
| `src/components/editor/effects/CometEffect.tsx` | thermalColorRamp com isFlash |
| `src/lib/pyroNoise.ts` | 5 novos compounds no FLICKER_BY_COMPOUND |
| `src/render_ultra/fireworks/burstSimulation.ts` | Dragon egg pattern |
| `src/render_ultra/fireworks/particleChemistry.ts` | Flash formula variations |

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | pyroNoise.ts — adicionar 5 compounds faltantes |
| 2 | burstSimulation.ts — dragon_egg pattern |
| 3 | particleChemistry.ts — flash formula variations |
| 4 | FireworkRenderer.tsx — integrar strobeFlicker + getCombustionHdrBoost |
| 5 | MineEffect + CometEffect — isFlash path |
| 6 | Build verification |

