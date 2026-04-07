

# Ciclo de Calibracao #9 — Dados dos Manuais de Pirotecnia e Quimica

## Dados Extraidos dos Documentos

### Chemistry of Pyrotechnics (Sparky)
- **Flash powder padrao**: KClO4 70% + Al 30% (dark aluminum) — stoichiometric
- **Black powder**: KNO3 75%, Charcoal 15%, Sulfur 10%
- **Strobe**: combustao oscilatoria com fase smolder (pouca luz) + fase burn intensa — modelo ON/OFF real
- **Magnalium**: 50/50 Al/Mg, ponto de fusao ~460C, gravidade especifica 2.0
- **Copper blue**: CuO decompoe → Cu + Cl → CuCl2 (blue emission) — requer chlorine donor (PVC/Parlon)
- **Iron sparks**: bright orange, precisa coating protetor (linseed oil)
- **Zinc**: bluish-green sparks, "electric stars" com ilusao de eletricidade
- **Titanium**: sparks brilhantes, alta capacidade termica
- **Barium green**: BaCO3-based, estavel, deep green
- **Strontium red**: SrCO3, burn rate irregular

### Complete Book of Flash Powder (Moran)
- **Standard salute**: KClO4 66% + Al 34%
- **Al combustion heat**: 7400 kcal/g (highest among common metals)
- **Mg combustion heat**: 6000 kcal/g
- **Flash burn time**: milissegundos (thousandths of a second)
- **TNT equivalence**: 75% para flash powder finely blended
- **Flake Al**: mais reativo que atomized, forma platelets microscopicos
- **Sulfur ignition**: 223C no ar — baixo ponto de ignicao

### Manual Finale 3D (Pyrosmart Mexico)
- GPU-intensive rendering (OpenGL/DirectX)
- Supplier catalogs com simulacoes calibradas
- Chain/cake timing configs

### Manual de Pirotecnia 2025 (Consejo Superior Ingenieros de Minas, Espanha)
- Regulamentacao europeia RD 989/2015
- Framework profissional para pirotecnia

## Problemas Identificados no Motor Atual

| # | Problema | Fonte |
|---|---------|-------|
| 1 | **Strobe/twinkle nao modela fase smolder real** — Chemistry of Pyrotechnics descreve strobe como oscilacao entre "smolder phase" (quase sem luz) e "intense burn phase". O blink atual usa sine wave suave, nao tem fase smolder com duracao variavel | Chemistry of Pyrotechnics |
| 2 | **Magnalium nao tem compound flicker** — 50/50 Al/Mg alloy e muito usado em dragon eggs e strobe; combina reatividade alta do Mg com estabilidade do Al. Nao tem entrada em `FLICKER_BY_COMPOUND` | Chemistry + Flash Powder |
| 3 | **Zinc/electric stars sem modelo** — zinc produz sparks azuladas/verdes com efeito "eletricidade". Nao tem compound entry nem visual model | Chemistry of Pyrotechnics |
| 4 | **Flash burn duration incorreta** — flash powder consome em milessegundos (0.001-0.01s). O `thermalColorRamp` trata white-hot phase como 4% da vida, mas para flash deveria ser 80%+ da vida porque e quase instantaneo | Flash Powder book |
| 5 | **Antimony trisulfide (Sb2S3) sem modelo** — usado em "bengal fire" e salutes como sensitizer, produz bright light com blue tinge. Nao tem compound entry | Chemistry + Flash Powder |
| 6 | **Sulfur ignition temperature nao modelado** — sulfur ignites at 223C (muito baixo), afeta priming e ease of ignition. Pode calibrar prefire times para composicoes com sulfur | Flash Powder book |

## Solucoes

### 1. Strobe oscillatory model em pyroNoise.ts
Adicionar funcao `strobeFlicker(seed, time, smolderDuration, burnDuration)`:
- Ciclo alternado: smolder (brightness 0.02-0.08) → burn (brightness 0.9-1.4)
- `smolderDuration` = 0.3-0.8s, `burnDuration` = 0.05-0.15s (baseado na descricao do livro)
- Duty cycle variavel por seed para organicidade

### 2. Novos compounds em FLICKER_BY_COMPOUND
- **magnalium**: base 0.40, amplitude 0.52, popStrength 0.58 (50/50 Al/Mg — extremamente reativo, burn irregular)
- **zinc**: base 0.55, amplitude 0.38, popStrength 0.35 (moderate, bluish sparks)
- **antimony**: base 0.58, amplitude: 0.40, popStrength 0.42 (bengal fire, bright with blue tinge)
- **sulfur**: base 0.65, amplitude 0.30, popStrength 0.25 (low ignition temp, steady burn)
- **magnaliumDragonEgg**: usar strobeFlicker com smolder/burn cycle

### 3. Flash duration model em thermalColorRamp
Adicionar parametro `flashDuration` ao thermalColorRamp:
- Para compound "flash": white-hot phase = 80% da vida (nao 4%)
- Transicao instantanea para charcoal (sem fase ember)
- Modelar TNT equivalence 75%: bloom/HDR multiplicador 3.0x durante burn

### 4. Combustion heat table em pyroPhysics.ts
Adicionar tabela `COMBUSTION_HEAT_KCAL` para calibrar intensidade de brilho por metal:
- Aluminum: 7400 kcal/g
- Magnesium: 6000 kcal/g
- Iron: 1600 kcal/g
- Titanium: 4700 kcal/g
- Charcoal: 7800 kcal/g (como carbono)
- Sulfur: 2200 kcal/g
Usar como multiplicador de `hdrBoost` no thermalColorRamp

## Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| `src/lib/pyroNoise.ts` | Strobe oscillatory model, novos compounds (magnalium, zinc, antimony, sulfur) |
| `src/lib/pyroPhysics.ts` | Tabela combustion heat por metal |

## Ordem de Execucao

| Passo | Tarefa |
|-------|--------|
| 1 | pyroNoise.ts — strobeFlicker + novos compounds |
| 2 | pyroNoise.ts — thermalColorRamp flash duration param |
| 3 | pyroPhysics.ts — combustion heat table |
| 4 | Build verification |

